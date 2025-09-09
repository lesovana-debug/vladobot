import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration schema with validation
 */
const configSchema = z.object({
  // Telegram Bot Configuration
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  
  // Default Settings
  REPORT_TIME_DEFAULT: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  TIMEZONE_DEFAULT: z.string().default('Europe/Berlin'),
  TARGET_USERNAME: z.string().default('@vlad311'),
  
  // Database Configuration
  DB_URL: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // Rate Limiting and Budget Control
  MAX_DAILY_TOKENS: z.coerce.number().min(1).default(10000),
  TELEGRAM_FILE_SIZE_LIMIT_MB: z.coerce.number().min(1).default(20),
  
  // Optional: Custom LLM Model
  LLM_MODEL: z.string().default('gpt-4o-mini'),
});

/**
 * Validated configuration object
 */
export const config = configSchema.parse({
  BOT_TOKEN: process.env.BOT_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  REPORT_TIME_DEFAULT: process.env.REPORT_TIME_DEFAULT,
  TIMEZONE_DEFAULT: process.env.TIMEZONE_DEFAULT,
  TARGET_USERNAME: process.env.TARGET_USERNAME,
  DB_URL: process.env.DB_URL,
  LOG_LEVEL: process.env.LOG_LEVEL,
  MAX_DAILY_TOKENS: process.env.MAX_DAILY_TOKENS,
  TELEGRAM_FILE_SIZE_LIMIT_MB: process.env.TELEGRAM_FILE_SIZE_LIMIT_MB,
  LLM_MODEL: process.env.LLM_MODEL,
});

/**
 * Database configuration
 */
export const dbConfig = {
  url: config.DB_URL || 'data/db.sqlite',
  isLocal: !config.DB_URL,
};

/**
 * Telegram configuration
 */
export const telegramConfig = {
  token: config.BOT_TOKEN,
  fileSizeLimitBytes: config.TELEGRAM_FILE_SIZE_LIMIT_MB * 1024 * 1024,
};

/**
 * OpenAI configuration
 */
export const openaiConfig = {
  apiKey: config.OPENAI_API_KEY,
  model: config.LLM_MODEL,
  maxTokens: config.MAX_DAILY_TOKENS,
};

/**
 * Scheduler configuration
 */
export const schedulerConfig = {
  defaultReportTime: config.REPORT_TIME_DEFAULT,
  defaultTimezone: config.TIMEZONE_DEFAULT,
  targetUsername: config.TARGET_USERNAME,
};

/**
 * Logging configuration
 */
export const loggingConfig = {
  level: config.LOG_LEVEL,
};

// Export types for TypeScript
export type Config = z.infer<typeof configSchema>;
