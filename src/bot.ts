import { Telegraf, Context } from 'telegraf';
import { telegramConfig } from './config';
import { logger, createChildLogger } from './logging';
import { db } from './storage';
import { sttService } from './stt';
import { summarizer } from './summarizer';
import { SchedulerService } from './scheduler';

/**
 * Bot context with additional properties
 */
interface BotContext extends Context {
  chatLogger: ReturnType<typeof createChildLogger>;
}

/**
 * Main bot class
 */
export class VladoBot {
  private bot: Telegraf<BotContext>;
  private scheduler: SchedulerService;

  constructor() {
    this.bot = new Telegraf<BotContext>(telegramConfig.token);
    this.scheduler = new SchedulerService(this.bot);
    
    this.setupMiddleware();
    this.setupCommands();
    this.setupMessageHandlers();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Logging middleware
    this.bot.use(async (ctx: any, next: any) => {
      ctx.chatLogger = createChildLogger({
        chatId: ctx.chat?.id?.toString(),
        userId: ctx.from?.id?.toString(),
        messageType: ctx.message ? Object.keys(ctx.message)[1] : 'unknown',
      });

      ctx.chatLogger.info('Message received', {
        chatType: ctx.chat?.type,
        messageId: ctx.message ? (ctx.message as any).message_id : null,
      });

      await next();
    });

    // Chat registration middleware
    this.bot.use(async (ctx: any, next: any) => {
      if (ctx.chat && ctx.from) {
        await this.registerChatAndUser(ctx);
      }
      await next();
    });
  }

  /**
   * Setup command handlers
   */
  private setupCommands(): void {
    // Start command
    this.bot.start(async (ctx: any) => {
      const helpText = `🤖 **VladoBot** - Ежедневные дайджесты чатов

Я создаю ежедневные саммари переписки в групповых чатах, включая транскрипцию голосовых сообщений и видеокружков.

**Для администраторов чата:**
1. Убедитесь, что у бота выключен Privacy Mode (через @BotFather)
2. Добавьте бота в группу
3. Используйте команды для настройки

**Основные команды:**
/settime 21:00 - установить время отчета
/settimezone Europe/Berlin - установить таймзону
/settarget @username - кого тегать в отчетах
/preview - создать саммари за сегодня
/help - полная справка

По умолчанию отчеты отправляются в 21:00 по времени Berlin.`;

      await ctx.reply(helpText, { parse_mode: 'Markdown' });
    });

    // Help command
    this.bot.help(async (ctx: any) => {
      const helpText = `📖 **Полная справка VladoBot**

**Команды для настройки:**
• \`/settime 21:00\` - время ежедневного отчета (формат HH:MM)
• \`/settimezone Europe/Berlin\` - таймзона чата
• \`/settarget @username\` - кого тегать в отчетах (по умолчанию @vlad311)

**Команды для пользователей:**
• \`/optout\` - исключить ваши сообщения из саммари
• \`/optin\` - включить ваши сообщения в саммари

**Команды для тестирования:**
• \`/preview\` - создать саммари за текущий день
• \`/status\` - показать статус бота и расписание

**Что делает бот:**
• Собирает все сообщения в чате (текст, фото, видео, голосовые, кружки)
• Транскрибирует голосовые сообщения и видеокружки через Whisper AI
• Создает структурированный дайджест с темами, решениями и статистикой
• Отправляет отчет ежедневно в указанное время

**Важно для администраторов:**
• Убедитесь, что у бота выключен Privacy Mode в @BotFather
• Бот должен видеть все сообщения в группе для корректной работы`;

      await ctx.reply(helpText, { parse_mode: 'Markdown' });
    });

    // Set time command
    this.bot.command('settime', async (ctx: any) => {
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        await ctx.reply('❌ Укажите время в формате HH:MM\nПример: /settime 21:00');
        return;
      }

      const time = args[0];
      if (!SchedulerService.validateTimeFormat(time)) {
        await ctx.reply('❌ Неверный формат времени. Используйте HH:MM\nПример: /settime 21:00');
        return;
      }

      if (!ctx.chat) {
        await ctx.reply('❌ Эта команда работает только в групповых чатах');
        return;
      }

      db.updateChatSettings(ctx.chat.id.toString(), { report_time: time });
      await this.scheduler.updateChatSchedule(ctx.chat.id.toString());

      await ctx.reply(`✅ Время ежедневного отчета установлено: ${time}`);
    });

    // Set timezone command
    this.bot.command('settimezone', async (ctx: any) => {
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        const timezones = SchedulerService.getAvailableTimezones();
        await ctx.reply(`❌ Укажите таймзону\nДоступные: ${timezones.join(', ')}`);
        return;
      }

      const timezone = args[0];
      if (!SchedulerService.validateTimezone(timezone)) {
        const timezones = SchedulerService.getAvailableTimezones();
        await ctx.reply(`❌ Неверная таймзона. Доступные: ${timezones.join(', ')}`);
        return;
      }

      if (!ctx.chat) {
        await ctx.reply('❌ Эта команда работает только в групповых чатах');
        return;
      }

      db.updateChatSettings(ctx.chat.id.toString(), { timezone });
      await this.scheduler.updateChatSchedule(ctx.chat.id.toString());

      await ctx.reply(`✅ Таймзона установлена: ${timezone}`);
    });

    // Set target command
    this.bot.command('settarget', async (ctx: any) => {
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        await ctx.reply('❌ Укажите username для тега\nПример: /settarget @vlad311');
        return;
      }

      const target = args[0];
      if (!target.startsWith('@')) {
        await ctx.reply('❌ Username должен начинаться с @\nПример: /settarget @vlad311');
        return;
      }

      if (!ctx.chat) {
        await ctx.reply('❌ Эта команда работает только в групповых чатах');
        return;
      }

      db.updateChatSettings(ctx.chat.id.toString(), { target_username: target });

      await ctx.reply(`✅ Целевой пользователь установлен: ${target}`);
    });

    // Opt out command
    this.bot.command('optout', async (ctx: any) => {
      if (!ctx.from) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      db.setUserOptOut(ctx.from.id.toString(), true);
      await ctx.reply('✅ Ваши сообщения исключены из саммари');
    });

    // Opt in command
    this.bot.command('optin', async (ctx: any) => {
      if (!ctx.from) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      db.setUserOptOut(ctx.from.id.toString(), false);
      await ctx.reply('✅ Ваши сообщения включены в саммари');
    });

    // Preview command
    this.bot.command('preview', async (ctx: any) => {
      if (!ctx.chat) {
        await ctx.reply('❌ Эта команда работает только в групповых чатах');
        return;
      }

      try {
        await ctx.reply('🔄 Создаю саммари за сегодня...');
        
        const summary = await summarizer.generatePreviewSummary(ctx.chat.id.toString());
        
        await ctx.reply(summary, { parse_mode: 'Markdown' });
      } catch (error) {
        ctx.chatLogger.error('Failed to generate preview', {
          error: error instanceof Error ? error.message : error,
        });
        await ctx.reply('❌ Ошибка при создании саммари. Проверьте логи.');
      }
    });

    // Status command
    this.bot.command('status', async (ctx: any) => {
      if (!ctx.chat) {
        await ctx.reply('❌ Эта команда работает только в групповых чатах');
        return;
      }

      const chat = db.getChat(ctx.chat.id.toString());
      if (!chat) {
        await ctx.reply('❌ Чат не зарегистрирован');
        return;
      }

      const status = this.scheduler.getStatus();
      const stats = await summarizer.getSummaryStats(ctx.chat.id.toString());

      const statusText = `📊 **Статус VladoBot**

**Настройки чата:**
• Время отчета: ${chat.report_time}
• Таймзона: ${chat.timezone}
• Целевой пользователь: ${chat.target_username}
• Статус: ${chat.is_active ? '✅ Активен' : '❌ Неактивен'}

**Статистика (7 дней):**
• Всего сообщений: ${stats.totalMessages}
• Среднее в день: ${stats.averagePerDay}
• Самые активные: ${stats.mostActiveUsers.slice(0, 3).map(u => u.username).join(', ')}

**Планировщик:**
• Активных задач: ${status.activeJobs}
• Запланированных чатов: ${status.scheduledChats.length}`;

      await ctx.reply(statusText, { parse_mode: 'Markdown' });
    });
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    // Handle all messages
    this.bot.on('message', async (ctx: any) => {
      if (!ctx.chat || !ctx.from || !ctx.message) return;

      try {
        await this.processMessage(ctx);
      } catch (error) {
        ctx.chatLogger.error('Failed to process message', {
          error: error instanceof Error ? error.message : error,
        });
      }
    });
  }

  /**
   * Process incoming message
   */
  private async processMessage(ctx: BotContext): Promise<void> {
    const message = ctx.message as any;
    const messageId = message.message_id.toString();
    const chatId = ctx.chat!.id.toString();
    const userId = ctx.from!.id.toString();

    // Determine message type and content
    let messageType: string;
    let content: string | null = null;
    let fileId: string | null = null;

    if (message.text) {
      messageType = 'text';
      content = message.text;
    } else if (message.photo) {
      messageType = 'photo';
      content = message.caption || null;
      fileId = message.photo[message.photo.length - 1].file_id;
    } else if (message.video) {
      messageType = 'video';
      content = message.caption || null;
      fileId = message.video.file_id;
    } else if (message.voice) {
      messageType = 'voice';
      fileId = message.voice.file_id;
    } else if (message.audio) {
      messageType = 'audio';
      content = message.caption || null;
      fileId = message.audio.file_id;
    } else if (message.video_note) {
      messageType = 'video_note';
      fileId = message.video_note.file_id;
    } else if (message.sticker) {
      messageType = 'sticker';
      content = `[${message.sticker.emoji || 'стикер'}]`;
    } else if (message.document) {
      messageType = 'document';
      content = message.caption || null;
      fileId = message.document.file_id;
    } else {
      messageType = 'unknown';
    }

    // Store message in database
    db.insertMessage({
      chat_id: chatId,
      message_id: messageId,
      user_id: userId,
      message_type: messageType as any,
      content,
      file_id: fileId,
      file_path: null,
      reply_to_message_id: message.reply_to_message?.message_id?.toString() || null,
    });

    // Process audio/video for transcription
    if (sttService.isSupportedAudioType(messageType) && fileId) {
      this.processAudioMessage(ctx, fileId, messageId, messageType);
    }

    ctx.chatLogger.debug('Message processed', {
      messageType,
      hasContent: !!content,
      hasFile: !!fileId,
    });
  }

  /**
   * Process audio message for transcription
   */
  private async processAudioMessage(
    ctx: BotContext,
    fileId: string,
    messageId: string,
    messageType: string
  ): Promise<void> {
    try {
      // Download file
      const filePath = await sttService.downloadTelegramFile(fileId, telegramConfig.token);
      if (!filePath) {
        ctx.chatLogger.warn('Failed to download audio file', { fileId });
        return;
      }

      // Get duration if available
      const message = ctx.message as any;
      const duration = message[messageType]?.duration;

      // Process for transcription
      await sttService.processAudioMessage(fileId, messageId, filePath, duration);

      ctx.chatLogger.info('Audio message processed for transcription', {
        fileId,
        messageId,
        messageType,
        duration,
      });
    } catch (error) {
      ctx.chatLogger.error('Failed to process audio message', {
        fileId,
        messageId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Register chat and user in database
   */
  private async registerChatAndUser(ctx: BotContext): Promise<void> {
    if (!ctx.chat || !ctx.from) return;

    const chatId = ctx.chat.id.toString();
    const userId = ctx.from.id.toString();

    // Register chat
    db.upsertChat({
      chat_id: chatId,
      title: ctx.chat.title || ctx.chat.first_name || 'Unknown Chat',
      type: ctx.chat.type as 'group' | 'supergroup' | 'channel',
      report_time: '21:00',
      timezone: 'Europe/Berlin',
      target_username: '@vlad311',
      is_active: true,
    });

    // Register user
    db.upsertUser({
      user_id: userId,
      username: ctx.from.username || null,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name || null,
      is_opted_out: false,
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.bot.catch((err: any, ctx: any) => {
      logger.error('Bot error', {
        error: err.message,
        stack: err.stack,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
      });
    });

    process.on('unhandledRejection', (reason: any, promise: any) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });

    process.on('uncaughtException', (error: any) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting VladoBot...');

      // Initialize scheduler
      await this.scheduler.initialize();

      // Start bot
      await this.bot.launch();

      logger.info('VladoBot started successfully');

      // Graceful shutdown
      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());
    } catch (error) {
      logger.error('Failed to start bot', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  public async stop(): Promise<void> {
    logger.info('Stopping VladoBot...');
    
    this.scheduler.stopAll();
    this.bot.stop('SIGINT');
    
    logger.info('VladoBot stopped');
  }
}

// Export bot instance
export const bot = new VladoBot();
