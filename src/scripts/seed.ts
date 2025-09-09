import { db } from '../storage';
import { logger } from '../logging';

/**
 * Seed script for testing purposes
 */
async function seedDatabase(): Promise<void> {
  try {
    logger.info('Seeding database with test data...');

    // Create test chat
    const testChat = db.upsertChat({
      chat_id: '-1001234567890',
      title: 'Test Chat',
      type: 'supergroup',
      report_time: '21:00',
      timezone: 'Europe/Berlin',
      target_username: '@vlad311',
      is_active: true,
    });

    logger.info('Created test chat', { chatId: testChat.chat_id });

    // Create test users
    const testUsers = [
      {
        user_id: '123456789',
        username: 'vlad311',
        first_name: 'Vlad',
        last_name: 'Test',
        is_opted_out: false,
      },
      {
        user_id: '987654321',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        is_opted_out: false,
      },
      {
        user_id: '555666777',
        username: 'optoutuser',
        first_name: 'OptOut',
        last_name: 'User',
        is_opted_out: true,
      },
    ];

    for (const user of testUsers) {
      const createdUser = db.upsertUser(user);
      logger.info('Created test user', { userId: createdUser.user_id, username: createdUser.username });
    }

    // Create test messages for today
    // const today = new Date();
    const messages = [
      {
        chat_id: testChat.chat_id,
        message_id: '1',
        user_id: '123456789',
        message_type: 'text' as const,
        content: 'Привет всем! Как дела?',
        file_id: null,
        file_path: null,
        reply_to_message_id: null,
      },
      {
        chat_id: testChat.chat_id,
        message_id: '2',
        user_id: '987654321',
        message_type: 'text' as const,
        content: 'Привет! Все отлично, спасибо! А у тебя как?',
        file_id: null,
        file_path: null,
        reply_to_message_id: '1',
      },
      {
        chat_id: testChat.chat_id,
        message_id: '3',
        user_id: '123456789',
        message_type: 'text' as const,
        content: 'Тоже хорошо! Кстати, кто-нибудь знает, когда будет встреча?',
        file_id: null,
        file_path: null,
        reply_to_message_id: null,
      },
      {
        chat_id: testChat.chat_id,
        message_id: '4',
        user_id: '987654321',
        message_type: 'text' as const,
        content: 'Завтра в 15:00 в офисе',
        file_id: null,
        file_path: null,
        reply_to_message_id: '3',
      },
      {
        chat_id: testChat.chat_id,
        message_id: '5',
        user_id: '123456789',
        message_type: 'photo' as const,
        content: 'Вот фото с прошлой встречи',
        file_id: 'BAADBAADrwADBREAAYag8mM',
        file_path: null,
        reply_to_message_id: null,
      },
      {
        chat_id: testChat.chat_id,
        message_id: '6',
        user_id: '555666777',
        message_type: 'text' as const,
        content: 'Это сообщение не должно попасть в саммари (пользователь opted out)',
        file_id: null,
        file_path: null,
        reply_to_message_id: null,
      },
    ];

    for (const message of messages) {
      const createdMessage = db.insertMessage(message);
      logger.info('Created test message', { 
        messageId: createdMessage.message_id, 
        type: createdMessage.message_type 
      });
    }

    // Create test transcript
    const testTranscript = db.insertTranscript({
      message_id: '7',
      file_id: 'BAADBAADrwADBREAAYag8mM',
      transcript_text: 'Это тестовая транскрипция голосового сообщения для демонстрации работы системы распознавания речи.',
      language: 'ru',
      duration: 5.2,
    });

    logger.info('Created test transcript', { 
      messageId: testTranscript.message_id,
      transcriptLength: testTranscript.transcript_text.length 
    });

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Failed to seed database', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Clear all test data
 */
async function clearTestData(): Promise<void> {
  try {
    logger.info('Clearing test data...');

    // Delete test chat and all related data
    db.deleteChatData('-1001234567890');

    logger.info('Test data cleared successfully');
  } catch (error) {
    logger.error('Failed to clear test data', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'clear') {
    clearTestData()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    seedDatabase()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

export { seedDatabase, clearTestData };
