"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
let RedisService = RedisService_1 = class RedisService {
    configService;
    logger = new common_1.Logger(RedisService_1.name);
    pubClient = null;
    subClient = null;
    isConnected = false;
    inMemoryPresence = new Map();
    inMemoryTyping = new Map();
    inMemoryRateLimits = new Map();
    constructor(configService) {
        this.configService = configService;
    }
    async onModuleInit() {
        const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
        try {
            this.pubClient = new ioredis_1.default(redisUrl, {
                maxRetriesPerRequest: 1,
                retryStrategy: () => null,
                connectTimeout: 3000,
                lazyConnect: true,
            });
            this.subClient = this.pubClient.duplicate();
            await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
            this.isConnected = true;
            this.logger.log(`Connected to Redis at ${redisUrl}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Redis not reachable at ${redisUrl} (${msg}). Running in resilient in-memory development mode.`);
            this.isConnected = false;
        }
    }
    async onModuleDestroy() {
        if (this.pubClient) {
            await this.pubClient.quit().catch(() => { });
        }
        if (this.subClient) {
            await this.subClient.quit().catch(() => { });
        }
    }
    isRedisConnected() {
        return this.isConnected;
    }
    getPubClient() {
        return this.pubClient;
    }
    getSubClient() {
        return this.subClient;
    }
    async recordHeartbeat(userId, email) {
        const now = Date.now();
        const cleanEmail = email.trim().toLowerCase();
        if (this.isConnected && this.pubClient) {
            const pipeline = this.pubClient.pipeline();
            pipeline.set(`presence:user:${userId}`, String(now), 'EX', 60);
            pipeline.set(`presence:email:${cleanEmail}`, String(now), 'EX', 60);
            pipeline.sadd('presence:active_users', userId);
            await pipeline.exec();
        }
        else {
            this.inMemoryPresence.set(userId, now);
            this.inMemoryPresence.set(cleanEmail, now);
        }
    }
    async isOnline(userIdOrEmail) {
        const key = userIdOrEmail.trim().toLowerCase();
        const now = Date.now();
        const thresholdMs = 45 * 1000;
        if (this.isConnected && this.pubClient) {
            const isId = key.length === 36 && key.includes('-');
            const redisKey = isId ? `presence:user:${key}` : `presence:email:${key}`;
            const val = await this.pubClient.get(redisKey);
            if (!val)
                return false;
            return now - parseInt(val, 10) <= thresholdMs;
        }
        else {
            const last = this.inMemoryPresence.get(key);
            if (!last)
                return false;
            return now - last <= thresholdMs;
        }
    }
    async setTyping(conversationId, userId, isTyping) {
        const key = `typing:${conversationId}:${userId}`;
        if (this.isConnected && this.pubClient) {
            if (isTyping) {
                await this.pubClient.set(key, '1', 'EX', 10);
            }
            else {
                await this.pubClient.del(key);
            }
        }
        else {
            let set = this.inMemoryTyping.get(conversationId);
            if (!set) {
                set = new Set();
                this.inMemoryTyping.set(conversationId, set);
            }
            if (isTyping) {
                set.add(userId);
            }
            else {
                set.delete(userId);
            }
        }
    }
    async checkRateLimit(identifier, limit = 60, windowSeconds = 60) {
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
        }
        else {
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
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map