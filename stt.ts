import OpenAI from 'openai';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { openaiConfig, telegramConfig } from './config';
import { logger } from './logging';
import { db } from './storage';

/**
 * Speech-to-text service for processing voice messages and video notes
 */
export class SpeechToTextService {
  private openai: OpenAI;
  private tempDir: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: openaiConfig.apiKey,
    });
    
    this.tempDir = join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  private ensureTempDir(): void {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Process voice message or video note
   */
  public async processAudioMessage(
    fileId: string,
    messageId: string,
    filePath: string,
    duration?: number
  ): Promise<string | null> {
    try {
      // Check if transcript already exists
      const existingTranscript = db.getTranscript(messageId, fileId);
      if (existingTranscript) {
        logger.info('Transcript already exists', { messageId, fileId });
        return existingTranscript.transcript_text;
      }

      // Check file size limit
      const fileSize = await this.getFileSize(filePath);
      if (fileSize > telegramConfig.fileSizeLimitBytes) {
        logger.warn('File too large for transcription', { 
          fileId, 
          size: fileSize, 
          limit: telegramConfig.fileSizeLimitBytes 
        });
        return null;
      }

      // Convert to MP3 if needed
      const mp3Path = await this.convertToMp3(filePath);
      
      // Transcribe using Whisper
      const transcript = await this.transcribeWithWhisper(mp3Path);
      
      // Save transcript to database
      if (transcript) {
        db.insertTranscript({
          message_id: messageId,
          file_id: fileId,
          transcript_text: transcript,
          language: 'ru', // Assuming Russian, could be detected
          duration: duration || null,
        });

        logger.info('Transcript saved', { 
          messageId, 
          fileId, 
          transcriptLength: transcript.length 
        });
      }

      // Cleanup temp files
      this.cleanupTempFile(mp3Path);
      if (mp3Path !== filePath) {
        this.cleanupTempFile(filePath);
      }

      return transcript;
    } catch (error) {
      logger.error('Failed to process audio message', {
        fileId,
        messageId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Download file from Telegram
   */
  public async downloadTelegramFile(fileId: string, botToken: string): Promise<string | null> {
    try {
      // Get file info from Telegram
      const fileInfoResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );

      if (!fileInfoResponse.data.ok) {
        throw new Error(`Failed to get file info: ${fileInfoResponse.data.description}`);
      }

      const filePath = fileInfoResponse.data.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

      // Download file
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 30000, // 30 seconds timeout
      });

      const localPath = join(this.tempDir, `${fileId}${extname(filePath)}`);
      const writer = require('fs').createWriteStream(localPath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(localPath));
        writer.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to download Telegram file', {
        fileId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Convert audio/video file to MP3
   */
  private async convertToMp3(inputPath: string): Promise<string> {
    const outputPath = join(this.tempDir, `${Date.now()}.mp3`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => {
          logger.error('FFmpeg conversion failed', { 
            inputPath, 
            error: err.message 
          });
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  private async transcribeWithWhisper(audioPath: string): Promise<string | null> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: require('fs').createReadStream(audioPath),
        model: 'whisper-1',
        language: 'ru', // Russian language
        response_format: 'text',
      });

      return transcription as string;
    } catch (error) {
      logger.error('Whisper transcription failed', {
        audioPath,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(filePath: string): Promise<number> {
    const fs = require('fs').promises;
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Cleanup temporary file
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        logger.debug('Cleaned up temp file', { filePath });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temp file', {
        filePath,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Check if file type is supported for transcription
   */
  public isSupportedAudioType(fileType: string): boolean {
    const supportedTypes = ['voice', 'audio', 'video_note'];
    return supportedTypes.includes(fileType);
  }

  /**
   * Get estimated transcription cost (rough estimate)
   */
  public getEstimatedCost(durationSeconds: number): number {
    // OpenAI Whisper pricing: $0.006 per minute
    const minutes = durationSeconds / 60;
    return minutes * 0.006;
  }

  /**
   * Batch process multiple audio messages
   */
  public async batchProcessAudioMessages(
    messages: Array<{
      fileId: string;
      messageId: string;
      filePath: string;
      duration?: number;
    }>
  ): Promise<Array<{ messageId: string; transcript: string | null }>> {
    const results = [];

    for (const msg of messages) {
      try {
        const transcript = await this.processAudioMessage(
          msg.fileId,
          msg.messageId,
          msg.filePath,
          msg.duration
        );
        results.push({ messageId: msg.messageId, transcript });
      } catch (error) {
        logger.error('Failed to process audio message in batch', {
          messageId: msg.messageId,
          error: error instanceof Error ? error.message : error,
        });
        results.push({ messageId: msg.messageId, transcript: null });
      }
    }

    return results;
  }

  /**
   * Cleanup old temporary files
   */
  public cleanupOldTempFiles(maxAgeHours: number = 24): void {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          logger.debug('Cleaned up old temp file', { filePath });
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old temp files', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

// Export singleton instance
export const sttService = new SpeechToTextService();
