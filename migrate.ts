import { db } from '../storage';
import { logger } from '../logging';

/**
 * Migration script
 */
async function runMigrations(): Promise<void> {
  try {
    logger.info('Running database migrations...');
    
    // The migrations are already handled in the DatabaseManager constructor
    // This script is mainly for manual migration runs if needed
    
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Failed to run migrations', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runMigrations };
