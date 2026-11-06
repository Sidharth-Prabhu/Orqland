import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private pubClient;
    private subClient;
    private isConnected;
    private inMemoryPresence;
    private inMemoryTyping;
    private inMemoryRateLimits;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    isRedisConnected(): boolean;
    getPubClient(): Redis | null;
    getSubClient(): Redis | null;
    recordHeartbeat(userId: string, email: string): Promise<void>;
    isOnline(userIdOrEmail: string): Promise<boolean>;
    setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void>;
    checkRateLimit(identifier: string, limit?: number, windowSeconds?: number): Promise<{
        allowed: boolean;
        retryAfterSeconds?: number;
    }>;
}
