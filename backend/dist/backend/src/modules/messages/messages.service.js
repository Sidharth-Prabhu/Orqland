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
var MessagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../infrastructure/database/database.service");
const schema_1 = require("../../infrastructure/database/schema");
const conversations_service_1 = require("../conversations/conversations.service");
const contracts_1 = require("@orqland/contracts");
const drizzle_orm_1 = require("drizzle-orm");
const crypto = require("crypto");
const EDIT_WINDOW_MS = 10 * 60 * 1000;
const DELETE_WINDOW_MS = 15 * 60 * 1000;
const ATTACHMENT_RETENTION_MS = 48 * 60 * 60 * 1000;
let MessagesService = MessagesService_1 = class MessagesService {
    dbService;
    conversationsService;
    logger = new common_1.Logger(MessagesService_1.name);
    inMemoryMessages = [];
    idempotencyCache = new Map();
    constructor(dbService, conversationsService) {
        this.dbService = dbService;
        this.conversationsService = conversationsService;
        this.seedDevMessages();
    }
    seedDevMessages() {
        const now = Date.now();
        this.inMemoryMessages = [
            {
                id: 'm0000000-0000-0000-0000-000000000001',
                conversationId: 'c0000000-0000-0000-0000-000000000001',
                senderId: 'u0000000-0000-0000-0000-000000000002',
                senderEmail: 'ycssidharth@gmail.com',
                senderName: 'Sidharth Prabhu',
                senderAvatar: 'https://lh3.googleusercontent.com/a/ACg8ocLc1nCqvrP5EtodEm0Zq5cKvkrYEH-I0jaoX8bFrpvmR4FyQeUh=s96-c',
                content: 'Hello! Checking in on the production architecture restructuring.',
                timestamp: '02:45 PM',
                date: 'Today',
                createdAt: now - 1800000,
                status: 'read',
            },
            {
                id: 'm0000000-0000-0000-0000-000000000002',
                conversationId: 'c0000000-0000-0000-0000-000000000001',
                senderId: 'a0000000-0000-0000-0000-000000000001',
                senderEmail: 'mailtosidharth.me@gmail.com',
                senderName: "Sidharth Prabhu's Workspace",
                senderAvatar: 'https://lh3.googleusercontent.com/a/ACg8ocK77osqTQ76zfsDwgj5r5kQZiKsBHRgjI-1NqrM62sChRVilDG5dA=s96-c',
                content: 'Technical Architecture discussion is active. All systems proceeding.',
                timestamp: '02:51 PM',
                date: 'Today',
                createdAt: now - 1200000,
                status: 'read',
            },
        ];
    }
    checkDlp(content) {
        const ccRegex = /\b(?:\d{4}[ -]?){3}(?:\d{4}|\d{1,3})\b/;
        const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;
        if (ccRegex.test(content) || ssnRegex.test(content)) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                errorCode: contracts_1.ChatErrorCode.SENSITIVE_CONTENT_BLOCKED,
                message: 'Message blocked by Data Loss Prevention (DLP) policy: sensitive credentials or numbers detected.',
            });
        }
    }
    async getMessages(conversationId, user, limit = 50, beforeTimestamp) {
        const conv = await this.conversationsService.getConversation(conversationId, user);
        const isBiz = user.role === 'business';
        const deletedAt = isBiz ? conv.businessDeletedAt : conv.clientDeletedAt;
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const conditions = [(0, drizzle_orm_1.eq)(schema_1.messages.conversationId, conversationId)];
                if (beforeTimestamp) {
                    conditions.push((0, drizzle_orm_1.lt)(schema_1.messages.createdAt, beforeTimestamp));
                }
                if (deletedAt) {
                    conditions.push((0, drizzle_orm_1.gt)(schema_1.messages.createdAt, deletedAt));
                }
                const msgRecords = await db
                    .select()
                    .from(schema_1.messages)
                    .where((0, drizzle_orm_1.and)(...conditions))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
                    .limit(limit + 1);
                const hasMore = msgRecords.length > limit;
                const sliced = hasMore ? msgRecords.slice(0, limit) : msgRecords;
                const msgIds = sliced.map((m) => m.id);
                const allAttachments = msgIds.length > 0
                    ? await db
                        .select()
                        .from(schema_1.messageAttachments)
                        .where((0, drizzle_orm_1.sql) `${schema_1.messageAttachments.messageId} IN ${msgIds}`)
                    : [];
                const attachmentMap = new Map();
                for (const att of allAttachments) {
                    const list = attachmentMap.get(att.messageId) || [];
                    const now = Date.now();
                    const loc = att.locationData;
                    list.push({
                        id: att.id,
                        type: att.type,
                        name: att.name,
                        url: att.url,
                        downloadUrl: att.url,
                        thumbnailUrl: att.thumbnailUrl || undefined,
                        size: att.size || undefined,
                        mimeType: att.mimeType || undefined,
                        uploadedAt: att.createdAt,
                        expiresAt: att.expiresAt,
                        isExpired: now > att.expiresAt,
                        locationData: loc || undefined,
                    });
                    attachmentMap.set(att.messageId, list);
                }
                const items = sliced.reverse().map((m) => {
                    const isMe = m.senderId === user.id;
                    const atts = attachmentMap.get(m.id) || [];
                    return {
                        id: m.id,
                        conversationId: m.conversationId,
                        senderId: m.senderId,
                        senderEmail: isMe ? user.email : conv.participant.email,
                        senderName: isMe ? user.name : conv.participant.name,
                        senderAvatar: isMe ? user.avatar : conv.participant.avatar,
                        content: m.deletedForEveryone ? 'This message was deleted' : (m.content || ''),
                        timestamp: m.timestampDisplay,
                        date: m.dateDisplay || 'Today',
                        createdAt: m.createdAt,
                        idempotencyKey: m.idempotencyKey || undefined,
                        isMe,
                        status: m.status || 'delivered',
                        attachment: atts[0],
                        attachments: atts,
                        deletedForEveryone: m.deletedForEveryone,
                        isEdited: m.isEdited,
                        editedAt: m.editedAt || undefined,
                    };
                });
                const nextCursor = hasMore && sliced.length > 0 ? sliced[0].id : undefined;
                return {
                    messages: items,
                    nextCursor,
                    hasMore,
                };
            }
            catch (err) {
                this.logger.error('Failed to query messages from DB:', err);
            }
        }
        let list = this.inMemoryMessages.filter((m) => m.conversationId === conversationId);
        if (deletedAt) {
            list = list.filter((m) => m.createdAt > deletedAt);
        }
        if (beforeTimestamp) {
            list = list.filter((m) => m.createdAt < beforeTimestamp);
        }
        list.sort((a, b) => a.createdAt - b.createdAt);
        const hasMore = list.length > limit;
        const items = (hasMore ? list.slice(list.length - limit) : list).map((m) => ({
            ...m,
            isMe: m.senderId === user.id,
        }));
        return {
            messages: items,
            hasMore,
            nextCursor: hasMore ? items[0]?.id : undefined,
        };
    }
    async sendMessage(user, dto) {
        const conv = await this.conversationsService.getConversation(dto.conversationId, user);
        if (conv.status === 'ended') {
            throw new common_1.ForbiddenException({
                statusCode: 403,
                errorCode: contracts_1.ChatErrorCode.CONVERSATION_ENDED,
                message: 'This conversation session has ended. Reopen the session to send new messages.',
            });
        }
        if (dto.idempotencyKey) {
            if (this.idempotencyCache.has(dto.idempotencyKey)) {
                this.logger.log(`Idempotency hit for key ${dto.idempotencyKey}; returning existing message.`);
                return this.idempotencyCache.get(dto.idempotencyKey);
            }
        }
        if (dto.content) {
            this.checkDlp(dto.content);
        }
        const now = Date.now();
        const timeString = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messageId = crypto.randomUUID();
        const incomingAttachments = [];
        if (dto.attachments && dto.attachments.length > 0) {
            for (const att of dto.attachments) {
                incomingAttachments.push({
                    id: att.id || crypto.randomUUID(),
                    type: att.type,
                    name: att.name,
                    url: att.url,
                    thumbnailUrl: att.thumbnailUrl,
                    size: att.size,
                    mimeType: att.mimeType,
                    uploadedAt: now,
                    expiresAt: now + ATTACHMENT_RETENTION_MS,
                    locationData: att.locationData,
                });
            }
        }
        else if (dto.attachment) {
            incomingAttachments.push({
                id: dto.attachment.id || crypto.randomUUID(),
                type: dto.attachment.type,
                name: dto.attachment.name,
                url: dto.attachment.url,
                thumbnailUrl: dto.attachment.thumbnailUrl,
                size: dto.attachment.size,
                mimeType: dto.attachment.mimeType,
                uploadedAt: now,
                expiresAt: now + ATTACHMENT_RETENTION_MS,
                locationData: dto.attachment.locationData,
            });
        }
        const createdMsg = {
            id: messageId,
            conversationId: dto.conversationId,
            senderId: user.id,
            senderEmail: user.email,
            senderName: user.name,
            senderAvatar: user.avatar,
            content: dto.content || (incomingAttachments.length > 0 ? (incomingAttachments[0].type === 'image' ? 'Sent an image' : 'Sent an attachment') : ''),
            timestamp: timeString,
            date: 'Today',
            createdAt: now,
            idempotencyKey: dto.idempotencyKey,
            isMe: true,
            status: 'delivered',
            attachment: incomingAttachments[0],
            attachments: incomingAttachments,
            deletedForEveryone: false,
            isEdited: false,
        };
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const isBiz = user.role === 'business';
                await db.transaction(async (tx) => {
                    await tx.insert(schema_1.messages).values({
                        id: messageId,
                        conversationId: dto.conversationId,
                        senderId: user.id,
                        content: createdMsg.content,
                        timestampDisplay: timeString,
                        dateDisplay: 'Today',
                        idempotencyKey: dto.idempotencyKey || null,
                        status: 'delivered',
                        isEdited: false,
                        deletedForEveryone: false,
                        createdAt: now,
                    });
                    for (const att of incomingAttachments) {
                        await tx.insert(schema_1.messageAttachments).values({
                            id: att.id,
                            messageId: messageId,
                            type: att.type,
                            name: att.name,
                            objectKey: att.id,
                            url: att.url,
                            thumbnailUrl: att.thumbnailUrl || null,
                            mimeType: att.mimeType || null,
                            size: att.size || null,
                            locationData: att.locationData || null,
                            expiresAt: att.expiresAt,
                            isExpired: false,
                            createdAt: now,
                        });
                    }
                    await tx
                        .update(schema_1.conversations)
                        .set({
                        lastMessageText: createdMsg.content,
                        lastMessageTime: timeString,
                        lastMessageTimestamp: now,
                        unreadByClient: isBiz ? (0, drizzle_orm_1.sql) `${schema_1.conversations.unreadByClient} + 1` : schema_1.conversations.unreadByClient,
                        unreadByBusiness: !isBiz ? (0, drizzle_orm_1.sql) `${schema_1.conversations.unreadByBusiness} + 1` : schema_1.conversations.unreadByBusiness,
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, dto.conversationId));
                });
                if (dto.idempotencyKey) {
                    this.idempotencyCache.set(dto.idempotencyKey, createdMsg);
                }
                return createdMsg;
            }
            catch (err) {
                this.logger.error('Failed to insert message into DB:', err);
            }
        }
        this.inMemoryMessages.push(createdMsg);
        if (dto.idempotencyKey) {
            this.idempotencyCache.set(dto.idempotencyKey, createdMsg);
        }
        return createdMsg;
    }
    async editMessage(user, dto) {
        const now = Date.now();
        this.checkDlp(dto.content);
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const existing = await db
                    .select()
                    .from(schema_1.messages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.messages.id, dto.messageId), (0, drizzle_orm_1.eq)(schema_1.messages.conversationId, dto.conversationId)))
                    .limit(1);
                if (existing.length === 0) {
                    throw new common_1.NotFoundException('Message not found.');
                }
                const msg = existing[0];
                if (msg.senderId !== user.id) {
                    throw new common_1.ForbiddenException('You can only edit your own messages.');
                }
                if (now - msg.createdAt > EDIT_WINDOW_MS) {
                    throw new common_1.BadRequestException({
                        statusCode: 400,
                        errorCode: contracts_1.ChatErrorCode.MESSAGE_EDIT_EXPIRED,
                        message: 'Messages can only be edited within 10 minutes of sending.',
                    });
                }
                await db
                    .update(schema_1.messages)
                    .set({
                    content: dto.content,
                    isEdited: true,
                    editedAt: now,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.messages.id, dto.messageId));
                return {
                    id: msg.id,
                    conversationId: msg.conversationId,
                    senderId: msg.senderId,
                    senderName: user.name,
                    senderAvatar: user.avatar,
                    content: dto.content,
                    timestamp: msg.timestampDisplay,
                    date: msg.dateDisplay || 'Today',
                    createdAt: msg.createdAt,
                    isMe: true,
                    isEdited: true,
                    editedAt: now,
                };
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException || err instanceof common_1.ForbiddenException || err instanceof common_1.NotFoundException) {
                    throw err;
                }
                this.logger.error('Failed to edit message in DB:', err);
            }
        }
        const msg = this.inMemoryMessages.find((m) => m.id === dto.messageId);
        if (!msg) {
            throw new common_1.NotFoundException('Message not found.');
        }
        if (msg.senderId !== user.id) {
            throw new common_1.ForbiddenException('You can only edit your own messages.');
        }
        if (now - msg.createdAt > EDIT_WINDOW_MS) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                errorCode: contracts_1.ChatErrorCode.MESSAGE_EDIT_EXPIRED,
                message: 'Messages can only be edited within 10 minutes of sending.',
            });
        }
        msg.content = dto.content;
        msg.isEdited = true;
        msg.editedAt = now;
        return msg;
    }
    async deleteMessage(user, dto) {
        const now = Date.now();
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const existing = await db
                    .select()
                    .from(schema_1.messages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.messages.id, dto.messageId), (0, drizzle_orm_1.eq)(schema_1.messages.conversationId, dto.conversationId)))
                    .limit(1);
                if (existing.length === 0) {
                    throw new common_1.NotFoundException('Message not found.');
                }
                const msg = existing[0];
                if (msg.senderId !== user.id && user.role !== 'business') {
                    throw new common_1.ForbiddenException('You can only delete your own messages.');
                }
                if (now - msg.createdAt > DELETE_WINDOW_MS) {
                    throw new common_1.BadRequestException({
                        statusCode: 400,
                        errorCode: contracts_1.ChatErrorCode.MESSAGE_DELETE_EXPIRED,
                        message: 'Messages can only be deleted within 15 minutes of sending.',
                    });
                }
                await db
                    .update(schema_1.messages)
                    .set({
                    content: 'This message was deleted',
                    deletedForEveryone: true,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.messages.id, dto.messageId));
                return {
                    id: msg.id,
                    conversationId: msg.conversationId,
                    senderId: msg.senderId,
                    senderName: user.name,
                    senderAvatar: user.avatar,
                    content: 'This message was deleted',
                    timestamp: msg.timestampDisplay,
                    date: msg.dateDisplay || 'Today',
                    createdAt: msg.createdAt,
                    isMe: msg.senderId === user.id,
                    deletedForEveryone: true,
                };
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException || err instanceof common_1.ForbiddenException || err instanceof common_1.NotFoundException) {
                    throw err;
                }
                this.logger.error('Failed to delete message in DB:', err);
            }
        }
        const msg = this.inMemoryMessages.find((m) => m.id === dto.messageId);
        if (!msg) {
            throw new common_1.NotFoundException('Message not found.');
        }
        if (msg.senderId !== user.id && user.role !== 'business') {
            throw new common_1.ForbiddenException('You can only delete your own messages.');
        }
        if (now - msg.createdAt > DELETE_WINDOW_MS) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                errorCode: contracts_1.ChatErrorCode.MESSAGE_DELETE_EXPIRED,
                message: 'Messages can only be deleted within 15 minutes of sending.',
            });
        }
        msg.content = 'This message was deleted';
        msg.deletedForEveryone = true;
        return msg;
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = MessagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        conversations_service_1.ConversationsService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map