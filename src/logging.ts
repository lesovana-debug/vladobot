import pino from 'pino';
import { loggingConfig } from './config';

/**
 * Logger instance with pretty printing for development
 */
export const logger = pino({
  level: loggingConfig.level,
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

/**
 * Create a child logger with additional context
 */
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

/**
 * Simple event logging function to avoid 'never' type issues
 */
export function logEvent(event: string, payload?: Record<string, unknown>) {
  logger.info({ event, ...payload });
}

/**
 * Factory function for event loggers
 */
export function makeEventLogger(event: string) {
  return (payload?: Record<string, unknown>) => {
    logger.info({ event, ...payload });
  };
}

/**
 * Log levels for reference
 */
export const LogLevel = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];
