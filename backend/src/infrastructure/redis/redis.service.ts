import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;

  // In-memory fallback if Redis daemon is not running in local development
  private inMemoryPresence = new Map<string, number>();
  private inMemoryTyping = new Map<string, Set<string>>();
  private inMemoryRateLimits = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    try {
      this.pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't spam reconnect logs if offline in dev
        connectTimeout: 3000,
        lazyConnect: true,
      });

      this.subClient = this.pubClient.duplicate();

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.isConnected = true;
      this.logger.log(`Connected to Redis at ${redisUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Redis not reachable at ${redisUrl} (${msg}). Running in resilient in-memory development mode.`
      );
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.pubClient) {
      await this.pubClient.quit().catch(() => {});
    }
    if (this.subClient) {
      await this.subClient.quit().catch(() => {});
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }

  getPubClient(): Redis | null {
    return this.pubClient;
  }

  getSubClient(): Redis | null {
    return this.subClient;
  }

  // ----------------------------------------------------
  // Distributed Presence (45s TTL)
  // ----------------------------------------------------
  async recordHeartbeat(userId: string, email: string): Promise<void> {
    const now = Date.now();
    const cleanEmail = email.trim().toLowerCase();

    if (this.isConnected && this.pubClient) {
      const pipeline = this.pubClient.pipeline();
      pipeline.set(`presence:user:${userId}`, String(now), 'EX', 60);
      pipeline.set(`presence:email:${cleanEmail}`, String(now), 'EX', 60);
      pipeline.sadd('presence:active_users', userId);
      await pipeline.exec();
    } else {
      this.inMemoryPresence.set(userId, now);
      this.inMemoryPresence.set(cleanEmail, now);
    }
  }

  async isOnline(userIdOrEmail: string): Promise<boolean> {
    const key = userIdOrEmail.trim().toLowerCase();
    const now = Date.now();
    const thresholdMs = 45 * 1000;

    if (this.isConnected && this.pubClient) {
      const isId = key.length === 36 && key.includes('-');
      const redisKey = isId ? `presence:user:${key}` : `presence:email:${key}`;
      const val = await this.pubClient.get(redisKey);
      if (!val) return false;
      return now - parseInt(val, 10) <= thresholdMs;
    } else {
      const last = this.inMemoryPresence.get(key);
      if (!last) return false;
      return now - last <= thresholdMs;
    }
  }

  // ----------------------------------------------------
  // Ephemeral Typing Indicators (10s TTL)
  // ----------------------------------------------------
  async setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    const key = `typing:${conversationId}:${userId}`;

    if (this.isConnected && this.pubClient) {
      if (isTyping) {
        await this.pubClient.set(key, '1', 'EX', 10);
      } else {
        await this.pubClient.del(key);
      }
    } else {
      let set = this.inMemoryTyping.get(conversationId);
      if (!set) {
        set = new Set();
        this.inMemoryTyping.set(conversationId, set);
      }
      if (isTyping) {
        set.add(userId);
      } else {
        set.delete(userId);
      }
    }
  }

  // ----------------------------------------------------
  // Distributed Rate Limiting (Sliding Window)
  // ----------------------------------------------------
  async checkRateLimit(
    identifier: string,
    limit = 60,
    windowSeconds = 60
  ): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    const id = identifier.trim().toLowerCase();

    if (this.isConnected && this.pubClient) {
      const key = `ratelimit:${id}`;
      const current = await this.pubClient.incr(key);
      if (current === 1) {
        await this.pubClient.expire(key, windowSeconds);
      }
      if (current > limit) {
        const ttl = await this.pubClient.ttl(key);
        return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
      }
      return { allowed: true };
    } else {
      let timestamps = this.inMemoryRateLimits.get(id) || [];
      const windowMs = windowSeconds * 1000;
      timestamps = timestamps.filter((t) => now - t < windowMs);

      if (timestamps.length >= limit) {
        const oldest = timestamps[0];
        const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
        return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
      }

      timestamps.push(now);
      this.inMemoryRateLimits.set(id, timestamps);
      return { allowed: true };
    }
  }
}
