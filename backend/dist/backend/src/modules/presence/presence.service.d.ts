import { RedisService } from '../../infrastructure/redis/redis.service';
export declare class PresenceService {
    private readonly redisService;
    private userSockets;
    constructor(redisService: RedisService);
    trackConnection(userId: string, socketId: string): Promise<boolean>;
    trackDisconnection(userId: string, socketId: string): Promise<boolean>;
    recordHeartbeat(userId: string, email: string): Promise<void>;
    isOnline(userIdOrEmail: string): Promise<boolean>;
    setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void>;
}
