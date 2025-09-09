import * as cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { db, Chat } from './storage';
import { summarizer } from './summarizer';
import { logger } from './logging';
// import { schedulerConfig } from './config';

/**
 * Scheduler service for managing daily reports
 */
export class SchedulerService {
  private bot: Telegraf;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  /**
   * Initialize scheduler for all active chats
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing scheduler...');
    
    const activeChats = db.getAllActiveChats();
    
    for (const chat of activeChats) {
      await this.scheduleChat(chat);
    }

    logger.info('Scheduler initialized', { 
      activeChats: activeChats.length,
      scheduledJobs: this.cronJobs.size 
    });
  }

  /**
   * Schedule daily report for a specific chat
   */
  public async scheduleChat(chat: Chat): Promise<void> {
    try {
      // Remove existing job if any
      this.unscheduleChat(chat.chat_id);

      // Parse time and timezone
      const [hours, minutes] = chat.report_time.split(':').map(Number);
      
      // Create cron expression for daily execution
      const cronExpression = `${minutes} ${hours} * * *`;
      
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Create and schedule the job
      const job = cron.schedule(cronExpression, async () => {
        await this.executeDailyReport(chat);
      }, {
        scheduled: false,
        timezone: chat.timezone,
      });

      // Store the job
      this.cronJobs.set(chat.chat_id, job);
      
      // Start the job
      job.start();

      logger.info('Scheduled daily report', {
        chatId: chat.chat_id,
        chatTitle: chat.title,
        reportTime: chat.report_time,
        timezone: chat.timezone,
        cronExpression,
      });
    } catch (error) {
      logger.error('Failed to schedule chat', {
        chatId: chat.chat_id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Unschedule daily report for a specific chat
   */
  public unscheduleChat(chatId: string): void {
    const job = this.cronJobs.get(chatId);
    if (job) {
      job.stop();
      job.destroy();
      this.cronJobs.delete(chatId);
      
      logger.info('Unscheduled daily report', { chatId });
    }
  }

  /**
   * Update schedule for a chat (when settings change)
   */
  public async updateChatSchedule(chatId: string): Promise<void> {
    const chat = db.getChat(chatId);
    if (chat && chat.is_active) {
      await this.scheduleChat(chat);
    } else {
      this.unscheduleChat(chatId);
    }
  }

  /**
   * Execute daily report for a chat
   */
  private async executeDailyReport(chat: Chat): Promise<void> {
    try {
      logger.info('Executing daily report', {
        chatId: chat.chat_id,
        chatTitle: chat.title,
        reportTime: chat.report_time,
      });

      // Get yesterday's date (since we run at the end of the day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if we should generate a summary
      const shouldGenerate = await summarizer.shouldGenerateSummary(chat.chat_id, yesterday);
      
      if (!shouldGenerate) {
        logger.info('No messages to summarize', {
          chatId: chat.chat_id,
          date: yesterday.toISOString().split('T')[0],
        });
        return;
      }

      // Generate summary
      const summary = await summarizer.generateDailySummary(chat.chat_id, yesterday);

      // Send summary to chat
      await this.bot.telegram.sendMessage(chat.chat_id, summary, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      logger.info('Daily report sent successfully', {
        chatId: chat.chat_id,
        summaryLength: summary.length,
        date: yesterday.toISOString().split('T')[0],
      });
    } catch (error) {
      logger.error('Failed to execute daily report', {
        chatId: chat.chat_id,
        error: error instanceof Error ? error.message : error,
      });

      // Try to send error notification to chat
      try {
        await this.bot.telegram.sendMessage(
          chat.chat_id,
          `❌ Ошибка при создании ежедневного отчета: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
        );
      } catch (sendError) {
        logger.error('Failed to send error notification', {
          chatId: chat.chat_id,
          error: sendError instanceof Error ? sendError.message : sendError,
        });
      }
    }
  }

  /**
   * Execute daily report for a specific chat and date (manual trigger)
   */
  public async executeManualReport(chatId: string, date?: Date): Promise<string> {
    const chat = db.getChat(chatId);
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const targetDate = date || new Date();
    return await summarizer.generateDailySummary(chatId, targetDate);
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    activeJobs: number;
    scheduledChats: string[];
    nextExecutions: Array<{ chatId: string; nextRun: string | null }>;
  } {
    const scheduledChats = Array.from(this.cronJobs.keys());
    const nextExecutions = scheduledChats.map(chatId => {
      const job = this.cronJobs.get(chatId);
      return {
        chatId,
        nextRun: job ? this.getNextExecution(job) : null,
      };
    });

    return {
      activeJobs: this.cronJobs.size,
      scheduledChats,
      nextExecutions,
    };
  }

  /**
   * Get next execution time for a cron job
   */
  private getNextExecution(job: any): string | null {
    try {
      // This is a simplified approach - in a real implementation,
      // you might want to use a more sophisticated method to get next execution
      return 'Next execution time calculation not implemented';
    } catch (error) {
      logger.warn('Failed to get next execution time', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  public stopAll(): void {
    logger.info('Stopping all scheduled jobs...');
    
    for (const [chatId, job] of this.cronJobs) {
      job.stop();
      job.destroy();
      logger.debug('Stopped job', { chatId });
    }
    
    this.cronJobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  /**
   * Restart scheduler (useful for configuration changes)
   */
  public async restart(): Promise<void> {
    logger.info('Restarting scheduler...');
    this.stopAll();
    await this.initialize();
    logger.info('Scheduler restarted');
  }

  /**
   * Validate time format (HH:MM)
   */
  public static validateTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Validate timezone
   */
  public static validateTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available timezones (common ones)
   */
  public static getAvailableTimezones(): string[] {
    return [
      'Europe/Berlin',
      'Europe/Moscow',
      'Europe/London',
      'Europe/Paris',
      'America/New_York',
      'America/Los_Angeles',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'UTC',
    ];
  }
}

// Export singleton instance (will be initialized with bot instance)
export let scheduler: SchedulerService;
