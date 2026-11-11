import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { userPushTokens } from '../../infrastructure/database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // In-memory fallback map (userId -> Set of FCM tokens) for dev
  private inMemoryTokens = new Map<string, Set<string>>();

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Register or refresh an FCM push token for a user
   */
  async registerToken(userId: string, token: string, deviceType = 'web'): Promise<void> {
    const now = Date.now();

    // 1. Save in Redis user tokens set
    const redisClient = this.redisService.getPubClient();
    if (this.redisService.isRedisConnected() && redisClient) {
      await redisClient.sadd(`fcm:tokens:${userId}`, token);
    } else {
      let set = this.inMemoryTokens.get(userId);
      if (!set) {
        set = new Set();
        this.inMemoryTokens.set(userId, set);
      }
      set.add(token);
    }

    // 2. Persist in database
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .insert(userPushTokens)
          .values({
            userId,
            fcmToken: token,
            deviceType,
            updatedAt: now,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: userPushTokens.fcmToken,
            set: {
              userId,
              deviceType,
              updatedAt: now,
            },
          });
      } catch (err) {
        this.logger.error('Failed to save push token in database:', err);
      }
    }
  }

  /**
   * Remove a token (e.g. on logout or invalid token)
   */
  async unregisterToken(token: string): Promise<void> {
    const redisClient = this.redisService.getPubClient();
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const records = await db
          .select()
          .from(userPushTokens)
          .where(eq(userPushTokens.fcmToken, token))
          .limit(1);

        if (records.length > 0) {
          const userId = records[0].userId;
          if (this.redisService.isRedisConnected() && redisClient) {
            await redisClient.srem(`fcm:tokens:${userId}`, token);
          } else {
            this.inMemoryTokens.get(userId)?.delete(token);
          }
          await db.delete(userPushTokens).where(eq(userPushTokens.fcmToken, token));
        }
      } catch (err) {
        this.logger.error('Failed to delete push token from database:', err);
      }
    }
  }

  /**
   * Retrieve all registered push tokens for a user
   */
  async getUserTokens(userId: string): Promise<string[]> {
    const tokens: string[] = [];

    // Check Redis / Memory first
    const redisClient = this.redisService.getPubClient();
    if (this.redisService.isRedisConnected() && redisClient) {
      const redisTokens = await redisClient.smembers(`fcm:tokens:${userId}`);
      if (redisTokens && redisTokens.length > 0) {
        return redisTokens;
      }
    } else {
      const memTokens = this.inMemoryTokens.get(userId);
      if (memTokens && memTokens.size > 0) {
        return Array.from(memTokens);
      }
    }

    // Query from PostgreSQL database
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const rows = await db
          .select({ token: userPushTokens.fcmToken })
          .from(userPushTokens)
          .where(eq(userPushTokens.userId, userId));

        for (const row of rows) {
          tokens.push(row.token);
        }
      } catch (err) {
        this.logger.error(`Failed to get push tokens for user ${userId}:`, err);
      }
    }

    return tokens;
  }

  /**
   * Send push notification to user's registered devices
   */
  async sendPushNotification(params: {
    recipientUserId?: string;
    recipientToken?: string;
    senderName: string;
    conversationId: string;
    hasAttachment?: boolean;
  }) {
    let tokens: string[] = [];

    if (params.recipientToken) {
      tokens.push(params.recipientToken);
    } else if (params.recipientUserId) {
      tokens = await this.getUserTokens(params.recipientUserId);
    }

    if (tokens.length === 0) {
      this.logger.debug(
        `Push notification skipped: No active FCM tokens for recipient ${params.recipientUserId || 'unknown'}`
      );
      return;
    }

    for (const token of tokens) {
      try {
        // Do not expose sensitive chat content in push notification payload
        await admin.messaging().send({
          token,
          notification: {
            title: `New message from ${params.senderName}`,
            body: params.hasAttachment ? 'Sent an attachment' : 'Sent you a new message',
          },
          data: {
            conversationId: params.conversationId,
            type: 'chat_message',
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.debug(`FCM push notification skipped/failed for token: ${msg}`);

        // If token is invalid or unregistered, clean it up
        if (
          msg.includes('registration-token-not-registered') ||
          msg.includes('invalid-registration-token')
        ) {
          await this.unregisterToken(token);
        }
      }
    }
  }
}
