import { bot } from './bot';
import { logger } from './logging';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting VladoBot application...');
    await bot.start();
  } catch (error) {
    logger.error('Failed to start application', {
      error: error instanceof Error ? error.message : error,
    });
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}
