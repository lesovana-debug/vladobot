import OpenAI from 'openai';
import { openaiConfig } from './config';
import { logger } from './logging';

/**
 * LLM Provider interface for abstraction
 */
export interface LLMProvider {
  generateSummary(messages: ProcessedMessage[], context: SummaryContext): Promise<string>;
  isAvailable(): Promise<boolean>;
}

/**
 * Processed message for summarization
 */
export interface ProcessedMessage {
  id: string;
  user: {
    username: string | null;
    firstName: string;
    lastName: string | null;
  };
  type: 'text' | 'photo' | 'video' | 'voice' | 'audio' | 'video_note' | 'sticker' | 'document';
  content: string | null;
  transcript?: string;
  timestamp: string;
  replyTo?: string;
}

/**
 * Context for summary generation
 */
export interface SummaryContext {
  chatTitle: string;
  date: string;
  totalMessages: number;
  targetUsername: string;
}

/**
 * OpenAI LLM Provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: openaiConfig.apiKey,
    });
  }

  /**
   * Generate daily summary using OpenAI
   */
  public async generateSummary(messages: ProcessedMessage[], context: SummaryContext): Promise<string> {
    try {
      const prompt = this.buildPrompt(messages, context);
      
      logger.info('Generating summary with OpenAI', {
        messageCount: messages.length,
        chatTitle: context.chatTitle,
        date: context.date,
      });

      const response = await this.client.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          {
            role: 'system',
            content: `Ты - помощник для создания ежедневных дайджестов чатов. Твоя задача - создать краткое, структурированное саммари переписки за день. Отвечай на русском языке.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const summary = response.choices[0]?.message?.content;
      if (!summary) {
        throw new Error('Empty response from OpenAI');
      }

      logger.info('Summary generated successfully', { 
        tokenUsage: response.usage,
        summaryLength: summary.length 
      });

      return summary;
    } catch (error) {
      logger.error('Failed to generate summary', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Check if OpenAI API is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.warn('OpenAI API not available', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  /**
   * Build prompt for summary generation
   */
  private buildPrompt(messages: ProcessedMessage[], context: SummaryContext): string {
    const messageTexts = messages.map(msg => {
      const userDisplay = msg.user.username ? `@${msg.user.username}` : msg.user.firstName;
      const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      let content = '';
      switch (msg.type) {
        case 'text':
          content = msg.content || '[пустое сообщение]';
          break;
        case 'photo':
          content = `[фото] ${msg.content || ''}`;
          break;
        case 'video':
          content = `[видео] ${msg.content || ''}`;
          break;
        case 'voice':
        case 'audio':
          content = `[голосовое] ${msg.transcript || '[не удалось распознать]'}`;
          break;
        case 'video_note':
          content = `[кружок] ${msg.transcript || '[не удалось распознать]'}`;
          break;
        case 'sticker':
          content = '[стикер]';
          break;
        case 'document':
          content = `[документ] ${msg.content || ''}`;
          break;
        default:
          content = `[${msg.type}] ${msg.content || ''}`;
      }

      return `[${time}] ${userDisplay}: ${content}`;
    }).join('\n');

    return `
Создай ежедневный дайджест для чата "${context.chatTitle}" за ${context.date}.

Сообщения за день (${context.totalMessages} шт.):
${messageTexts}

Требования к дайджесту:
1. Начни с обращения к ${context.targetUsername}
2. Структурируй информацию по разделам:
   - Темы: основные темы обсуждения
   - Итоги/решения: важные решения и договоренности
   - Кружки/аудио: краткое содержание голосовых и видеосообщений с указанием времени и автора
   - Забавное: интересные моменты, мемы, реакции
   - Статистика: количество сообщений за день

3. Будь кратким, но информативным
4. Используй эмодзи для структурирования
5. Не превышай 1200 символов

Формат ответа:
${context.targetUsername} Снова не прочитал чат, пес? Соси огрызки:

[твой дайджест здесь]
`;
  }
}

/**
 * Fallback LLM Provider for when OpenAI is not available
 */
export class FallbackProvider implements LLMProvider {
  public async generateSummary(messages: ProcessedMessage[], context: SummaryContext): Promise<string> {
    logger.warn('Using fallback summary provider');
    
    const textMessages = messages.filter(m => m.type === 'text' && m.content);
    const voiceMessages = messages.filter(m => (m.type === 'voice' || m.type === 'video_note') && m.transcript);
    const mediaMessages = messages.filter(m => ['photo', 'video', 'document'].includes(m.type));

    const summary = `${context.targetUsername} Снова не прочитал чат, пес? Соси огрызки:

📝 **Темы:** Обсуждение различных вопросов
📊 **Статистика:** ${context.totalMessages} сообщений за день
🎤 **Голосовые/кружки:** ${voiceMessages.length} аудиосообщений
📎 **Медиа:** ${mediaMessages.length} файлов
💬 **Текстовых:** ${textMessages.length} сообщений

_Детальное саммари временно недоступно. Проверьте настройки OpenAI API._`;

    return summary;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * LLM Provider factory
 */
export class LLMProviderFactory {
  private static instance: LLMProvider | null = null;

  public static async getProvider(): Promise<LLMProvider> {
    if (!this.instance) {
      const openaiProvider = new OpenAIProvider();
      const isAvailable = await openaiProvider.isAvailable();
      
      if (isAvailable) {
        this.instance = openaiProvider;
        logger.info('Using OpenAI provider');
      } else {
        this.instance = new FallbackProvider();
        logger.warn('Using fallback provider - OpenAI not available');
      }
    }

    return this.instance;
  }

  public static reset(): void {
    this.instance = null;
  }
}
