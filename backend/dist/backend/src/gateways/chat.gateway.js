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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const contracts_1 = require("@orqland/contracts");
const messages_service_1 = require("../modules/messages/messages.service");
const conversations_service_1 = require("../modules/conversations/conversations.service");
const presence_service_1 = require("../modules/presence/presence.service");
const notifications_service_1 = require("../modules/notifications/notifications.service");
const auth_service_1 = require("../modules/auth/auth.service");
const firebase_admin_service_1 = require("../modules/auth/firebase-admin.service");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    messagesService;
    conversationsService;
    presenceService;
    notificationsService;
    authService;
    firebaseAdmin;
    server;
    logger = new common_1.Logger(ChatGateway_1.name);
    constructor(messagesService, conversationsService, presenceService, notificationsService, authService, firebaseAdmin) {
        this.messagesService = messagesService;
        this.conversationsService = conversationsService;
        this.presenceService = presenceService;
        this.notificationsService = notificationsService;
        this.authService = authService;
        this.firebaseAdmin = firebaseAdmin;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake?.auth?.token ||
                client.handshake?.headers?.authorization;
            if (!token) {
                this.logger.warn(`WS connection without token from ${client.id}`);
                const devEmail = client.handshake?.auth?.email || 'mailtosidharth.me@gmail.com';
                const user = await this.authService.findUserByEmail(devEmail);
                if (user) {
                    client.data.user = user;
                }
                else {
                    client.disconnect();
                    return;
                }
            }
            else {
                const decoded = await this.firebaseAdmin.verifyIdToken(token);
                const user = await this.authService.resolveOrCreateUser(decoded);
                client.data.user = user;
            }
            const user = client.data.user;
            await client.join(`user:${user.id}`);
            const becameOnline = await this.presenceService.trackConnection(user.id, client.id);
            if (becameOnline) {
                this.server.emit(contracts_1.CHAT_EVENTS.PRESENCE_UPDATE, {
                    userId: user.id,
                    userEmail: user.email,
                    isOnline: true,
                    timestamp: Date.now(),
                });
            }
            this.logger.log(`WS Client connected: ${client.id} (User: ${user.email})`);
        }
        catch (err) {
            this.logger.error(`WS Authentication failed for ${client.id}:`, err?.message);
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const user = client.data?.user;
        if (user) {
            const wentOffline = await this.presenceService.trackDisconnection(user.id, client.id);
            if (wentOffline) {
                this.server.emit(contracts_1.CHAT_EVENTS.PRESENCE_UPDATE, {
                    userId: user.id,
                    userEmail: user.email,
                    isOnline: false,
                    lastSeenAt: Date.now(),
                    timestamp: Date.now(),
                });
            }
            this.logger.log(`WS Client disconnected: ${client.id} (User: ${user.email})`);
        }
    }
    async handleJoinConversation(client, payload) {
        const user = client.data.user;
        if (!user || !payload?.conversationId)
            return;
        try {
            await this.conversationsService.getConversation(payload.conversationId, user);
            await client.join(`conversation:${payload.conversationId}`);
            this.logger.log(`User ${user.email} joined room conversation:${payload.conversationId}`);
        }
        catch (err) {
            client.emit(contracts_1.CHAT_EVENTS.ERROR, {
                code: 'ROOM_ACCESS_DENIED',
                message: err.message,
            });
        }
    }
    async handleLeaveConversation(client, payload) {
        if (!payload?.conversationId)
            return;
        await client.leave(`conversation:${payload.conversationId}`);
    }
    async handleSendMessage(client, payload) {
        const user = client.data.user;
        if (!user) {
            client.emit(contracts_1.CHAT_EVENTS.ERROR, { code: 'UNAUTHORIZED', message: 'Not authenticated' });
            return;
        }
        try {
            const createdMessage = await this.messagesService.sendMessage(user, {
                conversationId: payload.conversationId,
                content: payload.content,
                idempotencyKey: payload.idempotencyKey,
                attachments: payload.attachments,
            });
            client.emit(contracts_1.CHAT_EVENTS.MESSAGE_ACK, {
                clientGeneratedId: payload.idempotencyKey,
                messageId: createdMessage.id,
                status: 'delivered',
                createdAt: createdMessage.createdAt,
            });
            this.server.to(`conversation:${payload.conversationId}`).emit(contracts_1.CHAT_EVENTS.MESSAGE_NEW, {
                ...createdMessage,
                isMe: false,
            });
            this.server.to(`conversation:${payload.conversationId}`).emit(contracts_1.CHAT_EVENTS.CONVERSATION_UPDATED, {
                conversationId: payload.conversationId,
                lastMessage: createdMessage.content,
                lastMessageTime: createdMessage.timestamp,
                lastMessageTimestamp: createdMessage.createdAt,
            });
            const conv = await this.conversationsService.getConversation(payload.conversationId, user);
            await this.notificationsService.sendPushNotification({
                senderName: user.name,
                conversationId: payload.conversationId,
                hasAttachment: Boolean(payload.attachments && payload.attachments.length > 0),
            });
        }
        catch (err) {
            this.logger.error(`Failed to handle message:send: ${err?.message}`);
            client.emit(contracts_1.CHAT_EVENTS.ERROR, {
                code: err?.response?.errorCode || 'MESSAGE_SEND_FAILED',
                message: err?.message || 'Failed to send message',
            });
        }
    }
    async handleMarkRead(client, payload) {
        const user = client.data.user;
        if (!user || !payload?.conversationId)
            return;
        try {
            await this.conversationsService.markAsRead(payload.conversationId, user);
            this.server.to(`conversation:${payload.conversationId}`).emit(contracts_1.CHAT_EVENTS.MESSAGE_READ_UPDATE, {
                conversationId: payload.conversationId,
                userId: user.id,
                readAt: Date.now(),
                lastReadMessageId: payload.lastReadMessageId,
            });
        }
        catch (err) {
            this.logger.warn(`Failed to mark as read: ${err?.message}`);
        }
    }
    async handleTypingStart(client, payload) {
        const user = client.data.user;
        if (!user || !payload?.conversationId)
            return;
        client.to(`conversation:${payload.conversationId}`).emit(contracts_1.CHAT_EVENTS.TYPING_UPDATE, {
            conversationId: payload.conversationId,
            userId: user.id,
            userName: user.name,
            isTyping: true,
        });
    }
    async handleTypingStop(client, payload) {
        const user = client.data.user;
        if (!user || !payload?.conversationId)
            return;
        client.to(`conversation:${payload.conversationId}`).emit(contracts_1.CHAT_EVENTS.TYPING_UPDATE, {
            conversationId: payload.conversationId,
            userId: user.id,
            userName: user.name,
            isTyping: false,
        });
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.CHAT_EVENTS.CONVERSATION_JOIN),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.CHAT_EVENTS.CONVERSATION_LEAVE),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleLeaveConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.CHAT_EVENTS.MESSAGE_SEND),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.CHAT_EVENTS.MESSAGE_READ),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMarkRead", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.CHAT_EVENTS.TYPING_START),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleTypingStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(contracts_1.CHAT_EVENTS.TYPING_STOP),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleTypingStop", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [messages_service_1.MessagesService,
        conversations_service_1.ConversationsService,
        presence_service_1.PresenceService,
        notifications_service_1.NotificationsService,
        auth_service_1.AuthService,
        firebase_admin_service_1.FirebaseAdminService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map