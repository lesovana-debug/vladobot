import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { dbConfig } from './config';
import { logger } from './logging';

/**
 * Database types and interfaces
 */
export interface Chat {
  id: number;
  chat_id: string;
  title: string;
  type: 'group' | 'supergroup' | 'channel';
  report_time: string;
  timezone: string;
  target_username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  user_id: string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  is_opted_out: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  chat_id: string;
  message_id: string;
  user_id: string;
  message_type: 'text' | 'photo' | 'video' | 'voice' | 'audio' | 'video_note' | 'sticker' | 'document';
  content: string | null;
  file_id: string | null;
  file_path: string | null;
  reply_to_message_id: string | null;
  created_at: string;
}

export interface Transcript {
  id: number;
  message_id: string;
  file_id: string;
  transcript_text: string;
  language: string | null;
  duration: number | null;
  created_at: string;
}

export interface Settings {
  id: number;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database manager class
 */
export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    // Ensure data directory exists
    const dbPath = dbConfig.url;
    if (dbConfig.isLocal) {
      const dbDir = dirname(dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    logger.info('Database initialized', { path: dbPath });
    this.runMigrations();
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    logger.info('Running database migrations...');

    // Create chats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('group', 'supergroup', 'channel')),
        report_time TEXT NOT NULL DEFAULT '21:00',
        timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
        target_username TEXT NOT NULL DEFAULT '@vlad311',
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT,
        is_opted_out BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK (message_type IN ('text', 'photo', 'video', 'voice', 'audio', 'video_note', 'sticker', 'document')),
        content TEXT,
        file_id TEXT,
        file_path TEXT,
        reply_to_message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chat_id, message_id),
        FOREIGN KEY (chat_id) REFERENCES chats(chat_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // Create transcripts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        transcript_text TEXT NOT NULL,
        language TEXT,
        duration REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, file_id)
      )
    `);

    // Create settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_transcripts_message_id ON transcripts(message_id);
    `);

    logger.info('Database migrations completed');
  }

  /**
   * Chat operations
   */
  public upsertChat(chat: Omit<Chat, 'id' | 'created_at' | 'updated_at'>): Chat {
    const stmt = this.db.prepare(`
      INSERT INTO chats (chat_id, title, type, report_time, timezone, target_username, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        title = excluded.title,
        type = excluded.type,
        report_time = excluded.report_time,
        timezone = excluded.timezone,
        target_username = excluded.target_username,
        is_active = excluded.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    return stmt.get(
      chat.chat_id,
      chat.title,
      chat.type,
      chat.report_time,
      chat.timezone,
      chat.target_username,
      chat.is_active
    ) as Chat;
  }

  public getChat(chatId: string): Chat | null {
    const stmt = this.db.prepare('SELECT * FROM chats WHERE chat_id = ?');
    return stmt.get(chatId) as Chat | null;
  }

  public getAllActiveChats(): Chat[] {
    const stmt = this.db.prepare('SELECT * FROM chats WHERE is_active = 1');
    return stmt.all() as Chat[];
  }

  public updateChatSettings(chatId: string, settings: Partial<Pick<Chat, 'report_time' | 'timezone' | 'target_username'>>): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (settings.report_time) {
      updates.push('report_time = ?');
      values.push(settings.report_time);
    }
    if (settings.timezone) {
      updates.push('timezone = ?');
      values.push(settings.timezone);
    }
    if (settings.target_username) {
      updates.push('target_username = ?');
      values.push(settings.target_username);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(chatId);

    const stmt = this.db.prepare(`UPDATE chats SET ${updates.join(', ')} WHERE chat_id = ?`);
    stmt.run(...values);
  }

  /**
   * User operations
   */
  public upsertUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): User {
    const stmt = this.db.prepare(`
      INSERT INTO users (user_id, username, first_name, last_name, is_opted_out)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        is_opted_out = excluded.is_opted_out,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    return stmt.get(
      user.user_id,
      user.username,
      user.first_name,
      user.last_name,
      user.is_opted_out
    ) as User;
  }

  public getUser(userId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE user_id = ?');
    return stmt.get(userId) as User | null;
  }

  public setUserOptOut(userId: string, isOptedOut: boolean): void {
    const stmt = this.db.prepare('UPDATE users SET is_opted_out = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    stmt.run(isOptedOut, userId);
  }

  /**
   * Message operations
   */
  public insertMessage(message: Omit<Message, 'id' | 'created_at'>): Message {
    const stmt = this.db.prepare(`
      INSERT INTO messages (chat_id, message_id, user_id, message_type, content, file_id, file_path, reply_to_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      message.chat_id,
      message.message_id,
      message.user_id,
      message.message_type,
      message.content,
      message.file_id,
      message.file_path,
      message.reply_to_message_id
    ) as Message;
  }

  public getMessagesForDateRange(chatId: string, startDate: string, endDate: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT m.*, u.username, u.first_name, u.last_name, u.is_opted_out
      FROM messages m
      JOIN users u ON m.user_id = u.user_id
      WHERE m.chat_id = ? AND m.created_at >= ? AND m.created_at < ?
      ORDER BY m.created_at ASC
    `);
    return stmt.all(chatId, startDate, endDate) as Message[];
  }

  /**
   * Transcript operations
   */
  public insertTranscript(transcript: Omit<Transcript, 'id' | 'created_at'>): Transcript {
    const stmt = this.db.prepare(`
      INSERT INTO transcripts (message_id, file_id, transcript_text, language, duration)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      transcript.message_id,
      transcript.file_id,
      transcript.transcript_text,
      transcript.language,
      transcript.duration
    ) as Transcript;
  }

  public getTranscript(messageId: string, fileId: string): Transcript | null {
    const stmt = this.db.prepare('SELECT * FROM transcripts WHERE message_id = ? AND file_id = ?');
    return stmt.get(messageId, fileId) as Transcript | null;
  }

  /**
   * Settings operations
   */
  public setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  public getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as { value: string } | null;
    return result?.value || null;
  }

  /**
   * Cleanup operations
   */
  public deleteChatData(chatId: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
      this.db.prepare('DELETE FROM chats WHERE chat_id = ?').run(chatId);
    });
    transaction();
  }

  public cleanupOldMessages(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const stmt = this.db.prepare('DELETE FROM messages WHERE created_at < ?');
    const result = stmt.run(cutoffDate.toISOString());
    
    logger.info('Cleaned up old messages', { 
      deletedCount: result.changes,
      cutoffDate: cutoffDate.toISOString()
    });
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }
}

// Export singleton instance
export const db = new DatabaseManager();
