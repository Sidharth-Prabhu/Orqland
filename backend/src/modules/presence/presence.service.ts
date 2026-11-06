import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class PresenceService {
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly redisService: RedisService) {}

  async trackConnection(userId: string, socketId: string): Promise<boolean> {
    let sockets = this.userSockets.get(userId);
    const wasOffline = !sockets || sockets.size === 0;
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);
    await this.redisService.recordHeartbeat(userId, userId);
    return wasOffline;
  }

  async trackDisconnection(userId: string, socketId: string): Promise<boolean> {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        return true; // went offline
      }
    }
    return false;
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
