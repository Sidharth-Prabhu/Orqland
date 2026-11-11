import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  async trackConnection(userId: string, socketId: string): Promise<boolean> {
    return this.redisService.trackUserSocket(userId, socketId);
  }

  async trackDisconnection(userId: string, socketId: string): Promise<boolean> {
    return this.redisService.untrackUserSocket(userId, socketId);
  }

  async recordHeartbeat(userId: string, email: string): Promise<void> {
    await this.redisService.recordHeartbeat(userId, email);
  }

  async isOnline(userIdOrEmail: string): Promise<boolean> {
    return this.redisService.isOnline(userIdOrEmail);
  }

  async setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    await this.redisService.setTyping(conversationId, userId, isTyping);
  }
}
