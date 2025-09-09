import { db } from './storage';
import { LLMProvider, LLMProviderFactory, ProcessedMessage, SummaryContext } from './llm';
import { logger } from './logging';

/**
 * Message processing result
 */
export interface ProcessedMessageData {
  messages: ProcessedMessage[];
  totalCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * Daily summarizer service
 */
export class DailySummarizer {
  private llmProvider: LLMProvider | null = null;

  /**
   * Initialize LLM provider
   */
  private async getLLMProvider(): Promise<LLMProvider> {
    if (!this.llmProvider) {
      this.llmProvider = await LLMProviderFactory.getProvider();
    }
    return this.llmProvider;
  }

  /**
   * Generate summary for a specific chat and date
   */
  public async generateDailySummary(chatId: string, date: Date): Promise<string> {
    try {
      const chat = db.getChat(chatId);
      if (!chat) {
        throw new Error(`Chat ${chatId} not found`);
      }

      const messages = await this.getMessagesForDate(chatId, date);
      if (messages.messages.length === 0) {
        return this.generateEmptySummary(chat.target_username);
      }

      const context: SummaryContext = {
        chatTitle: chat.title,
        date: date.toLocaleDateString('ru-RU'),
        totalMessages: messages.totalCount,
        targetUsername: chat.target_username,
      };

      const provider = await this.getLLMProvider();
      const summary = await provider.generateSummary(messages.messages, context);

      logger.info('Daily summary generated', {
        chatId,
        date: date.toISOString().split('T')[0],
        messageCount: messages.totalCount,
        summaryLength: summary.length,
      });

      return summary;
    } catch (error) {
      logger.error('Failed to generate daily summary', {
        chatId,
        date: date.toISOString(),
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Get messages for a specific date
   */
  private async getMessagesForDate(chatId: string, date: Date): Promise<ProcessedMessageData> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const rawMessages = db.getMessagesForDateRange(
      chatId,
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    // Filter out messages from opted-out users
    const filteredMessages = rawMessages.filter((msg: any) => !(msg as any).is_opted_out);

    // Process messages and add transcripts
    const processedMessages: ProcessedMessage[] = [];
    
    for (const msg of filteredMessages) {
      const processed: ProcessedMessage = {
        id: msg.message_id,
        user: {
          username: (msg as any).username,
          firstName: (msg as any).first_name,
          lastName: (msg as any).last_name,
        },
        type: msg.message_type as ProcessedMessage['type'],
        content: msg.content,
        timestamp: msg.created_at,
        replyTo: msg.reply_to_message_id || undefined,
      };

      // Add transcript for voice/audio messages
      if ((msg.message_type === 'voice' || msg.message_type === 'video_note' || msg.message_type === 'audio') && msg.file_id) {
        const transcript = db.getTranscript(msg.message_id, msg.file_id);
        if (transcript) {
          processed.transcript = transcript.transcript_text;
        }
      }

      processedMessages.push(processed);
    }

    return {
      messages: processedMessages,
      totalCount: rawMessages.length,
      dateRange: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
      },
    };
  }

  /**
   * Generate empty summary when no messages
   */
  private generateEmptySummary(targetUsername: string): string {
    return `${targetUsername} Снова не прочитал чат, пес? Соси огрызки:

📝 **Темы:** Никаких обсуждений
📊 **Статистика:** 0 сообщений за день
🎤 **Голосовые/кружки:** Нет
📎 **Медиа:** Нет
💬 **Текстовых:** Нет

_Сегодня в чате было тихо. Возможно, все заняты важными делами!_ 😴`;
  }

  /**
   * Get summary statistics for a chat
   */
  public async getSummaryStats(chatId: string, days: number = 7): Promise<{
    totalMessages: number;
    averagePerDay: number;
    mostActiveUsers: Array<{ username: string; messageCount: number }>;
    messageTypes: Record<string, number>;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = db.getMessagesForDateRange(
      chatId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    const totalMessages = messages.length;
    const averagePerDay = Math.round(totalMessages / days);

    // Count messages by user
    const userCounts = new Map<string, number>();
    const messageTypeCounts: Record<string, number> = {};

    for (const msg of messages) {
      if (!(msg as any).is_opted_out) {
        const username = (msg as any).username || (msg as any).first_name;
        userCounts.set(username, (userCounts.get(username) || 0) + 1);
        
        messageTypeCounts[msg.message_type] = (messageTypeCounts[msg.message_type] || 0) + 1;
      }
    }

    const mostActiveUsers = Array.from(userCounts.entries())
      .map(([username, messageCount]) => ({ username, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5);

    return {
      totalMessages,
      averagePerDay,
      mostActiveUsers,
      messageTypes: messageTypeCounts,
    };
  }

  /**
   * Generate preview summary for current day
   */
  public async generatePreviewSummary(chatId: string): Promise<string> {
    const today = new Date();
    return this.generateDailySummary(chatId, today);
  }

  /**
   * Check if summary should be generated (has messages and not empty)
   */
  public async shouldGenerateSummary(chatId: string, date: Date): Promise<boolean> {
    const messages = await this.getMessagesForDate(chatId, date);
    return messages.messages.length > 0;
  }
}

// Export singleton instance
export const summarizer = new DailySummarizer();
