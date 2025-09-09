import { summarizer } from '../summarizer';
import { logger } from '../logging';

/**
 * Preview script for testing summarization
 */
async function generatePreview(): Promise<void> {
  try {
    logger.info('Generating preview summary...');

    // Use test chat ID
    const testChatId = '-1001234567890';
    
    // Generate summary for today
    const summary = await summarizer.generatePreviewSummary(testChatId);
    
    console.log('\n=== PREVIEW SUMMARY ===');
    console.log(summary);
    console.log('========================\n');

    // Get statistics
    const stats = await summarizer.getSummaryStats(testChatId);
    
    console.log('=== STATISTICS ===');
    console.log(`Total messages (7 days): ${stats.totalMessages}`);
    console.log(`Average per day: ${stats.averagePerDay}`);
    console.log('Most active users:');
    stats.mostActiveUsers.forEach((user: any, index: any) => {
      console.log(`  ${index + 1}. ${user.username}: ${user.messageCount} messages`);
    });
    console.log('Message types:');
    Object.entries(stats.messageTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log('==================\n');

    logger.info('Preview generation completed');
  } catch (error) {
    logger.error('Failed to generate preview', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// Run preview if called directly
if (require.main === module) {
  generatePreview()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { generatePreview };
