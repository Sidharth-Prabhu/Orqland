import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MessagesService } from '../messages/messages.service';
import { messageAttachments } from '../../infrastructure/database/schema';
import { lt, and, eq } from 'drizzle-orm';

@Injectable()
export class AttachmentPurgeCronService {
  private readonly logger = new Logger(AttachmentPurgeCronService.name);
  private isRunning = false;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
    private readonly messagesService: MessagesService
  ) {}

  /**
   * Run every hour to purge attachments whose 48-hour retention window has elapsed
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handlePurgeCron() {
    if (this.isRunning) {
      this.logger.debug('Attachment purge cron is already running, skipping overlapping execution.');
      return;
    }

    this.isRunning = true;
    const now = Date.now();
    this.logger.log(`[AttachmentPurgeCron] Starting 48-hour attachment purge scan at ${new Date(now).toISOString()}...`);

    try {
      let filesDeleted = 0;

      // 1. Purge persistent PostgreSQL attachment records
      if (this.dbService.isDbConnected()) {
        const db = this.dbService.getDb();
        const expiredRecords = await db
          .select()
          .from(messageAttachments)
          .where(
            and(
              lt(messageAttachments.expiresAt, new Date(now)),
              eq(messageAttachments.isExpired, false)
            )
          );

        if (expiredRecords.length > 0) {
          this.logger.log(`[AttachmentPurgeCron] Found ${expiredRecords.length} expired attachments in database.`);

          for (const item of expiredRecords) {
            try {
              // Delete from storage backend
              if (item.storageKey) {
                await this.storageService.deleteObject(item.storageKey);
              }

              // Delete from Redis dev buffer if exists
              await this.redisService.deleteAttachmentBuffer(item.id);

              // Update DB status to expired and clear url
              await db
                .update(messageAttachments)
                .set({
                  isExpired: true,
                  url: '',
                  expiredAt: new Date(now),
                })
                .where(eq(messageAttachments.id, item.id));

              filesDeleted++;
            } catch (itemErr) {
              this.logger.error(`[AttachmentPurgeCron] Error purging attachment ${item.id}:`, itemErr);
            }
          }
        }
      }

      // 2. Also purge in-memory fallback messages
      const inMemoryResult = await this.messagesService.purgeExpiredAttachments();
      const totalPurged = filesDeleted + inMemoryResult.purgedCount;

      this.logger.log(`[AttachmentPurgeCron] 48-hour purge scan completed. Purged ${totalPurged} expired attachments.`);
    } catch (err) {
      this.logger.error('[AttachmentPurgeCron] Unexpected failure during attachment purge run:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger method for testing or immediate admin purge
   */
  async triggerPurgeNow() {
    await this.handlePurgeCron();
  }
}
