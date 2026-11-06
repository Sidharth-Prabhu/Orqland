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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../infrastructure/redis/redis.service");
let PresenceService = class PresenceService {
    redisService;
    userSockets = new Map();
    constructor(redisService) {
        this.redisService = redisService;
    }
    async trackConnection(userId, socketId) {
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
    async trackDisconnection(userId, socketId) {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
            sockets.delete(socketId);
            if (sockets.size === 0) {
                this.userSockets.delete(userId);
                return true;
            }
        }
        return false;
    }
    async recordHeartbeat(userId, email) {
        await this.redisService.recordHeartbeat(userId, email);
    }
    async isOnline(userIdOrEmail) {
        return this.redisService.isOnline(userIdOrEmail);
    }
    async setTyping(conversationId, userId, isTyping) {
        await this.redisService.setTyping(conversationId, userId, isTyping);
    }
};
exports.PresenceService = PresenceService;
exports.PresenceService = PresenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], PresenceService);
//# sourceMappingURL=presence.service.js.map