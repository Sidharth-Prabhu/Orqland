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
var ConversationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../infrastructure/database/database.service");
const schema_1 = require("../../infrastructure/database/schema");
const auth_service_1 = require("../auth/auth.service");
const presence_service_1 = require("../presence/presence.service");
const drizzle_orm_1 = require("drizzle-orm");
const crypto = require("crypto");
let ConversationsService = ConversationsService_1 = class ConversationsService {
    dbService;
    authService;
    presenceService;
    logger = new common_1.Logger(ConversationsService_1.name);
    inMemoryConversations = [];
    constructor(dbService, authService, presenceService) {
        this.dbService = dbService;
        this.authService = authService;
        this.presenceService = presenceService;
        this.seedDevConversations();
    }
    seedDevConversations() {
        this.inMemoryConversations = [
            {
                id: 'c0000000-0000-0000-0000-000000000001',
                clientId: 'u0000000-0000-0000-0000-000000000002',
                clientEmail: 'ycssidharth@gmail.com',
                clientName: 'Sidharth Prabhu',
                clientAvatar: 'https://lh3.googleusercontent.com/a/ACg8ocLc1nCqvrP5EtodEm0Zq5cKvkrYEH-I0jaoX8bFrpvmR4FyQeUh=s96-c',
                businessId: 'a0000000-0000-0000-0000-000000000001',
                businessEmail: 'mailtosidharth.me@gmail.com',
                businessName: "Sidharth Prabhu's Workspace",
                businessAvatar: 'https://lh3.googleusercontent.com/a/ACg8ocK77osqTQ76zfsDwgj5r5kQZiKsBHRgjI-1NqrM62sChRVilDG5dA=s96-c',
                participant: {
                    id: 'u0000000-0000-0000-0000-000000000002',
                    name: 'Sidharth Prabhu',
                    email: 'ycssidharth@gmail.com',
                    avatar: 'https://lh3.googleusercontent.com/a/ACg8ocLc1nCqvrP5EtodEm0Zq5cKvkrYEH-I0jaoX8bFrpvmR4FyQeUh=s96-c',
                    isOnline: true,
                    role: 'client',
                },
                status: 'active',
                lastMessage: 'Technical Architecture discussion',
                lastMessageTime: '02:51 PM',
                lastMessageTimestamp: Date.now() - 3600000,
                unreadCount: 0,
                workspaceInfo: {
                    name: 'Technical Architecture',
                    type: 'Orqspace',
                    description: 'Direct communication channel between business and client.',
                },
                messages: [],
            },
        ];
    }
    async listUserConversations(user) {
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const userEmail = user.email.toLowerCase();
                const isBiz = user.role === 'business';
                const convList = await db
                    .select()
                    .from(schema_1.conversations)
                    .where(isBiz ? (0, drizzle_orm_1.eq)(schema_1.conversations.businessId, user.id) : (0, drizzle_orm_1.eq)(schema_1.conversations.clientId, user.id))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.conversations.lastMessageTimestamp));
                const result = [];
                for (const c of convList) {
                    if (isBiz && c.deletedByBusinessAt) {
                        if ((c.lastMessageTimestamp || 0) <= c.deletedByBusinessAt) {
                            continue;
                        }
                    }
                    if (!isBiz && c.deletedForClientAt) {
                        if ((c.lastMessageTimestamp || 0) <= c.deletedForClientAt) {
                            continue;
                        }
                    }
                    const otherUserId = isBiz ? c.clientId : c.businessId;
                    const otherUser = await this.authService.findUserById(otherUserId);
                    const isOtherOnline = otherUser
                        ? await this.presenceService.isOnline(otherUser.id)
                        : false;
                    const clientUser = isBiz ? otherUser : user;
                    const bizUser = isBiz ? user : otherUser;
                    result.push({
                        id: c.id,
                        clientId: c.clientId,
                        clientEmail: clientUser?.email || '',
                        clientName: clientUser?.name || 'Client',
                        clientAvatar: clientUser?.avatar || '',
                        businessId: c.businessId,
                        businessEmail: bizUser?.email || '',
                        businessName: bizUser?.name || 'Business Workspace',
                        businessAvatar: bizUser?.avatar || '',
                        participant: {
                            id: otherUserId,
                            name: otherUser?.name || (isBiz ? 'Client' : 'Business'),
                            email: otherUser?.email,
                            avatar: otherUser?.avatar || '',
                            handle: otherUser?.handle || `@${otherUser?.email?.split('@')[0]}`,
                            isOnline: isOtherOnline,
                            role: isBiz ? 'client' : 'business',
                        },
                        status: c.status,
                        endedAt: c.endedAt || undefined,
                        endedBy: c.endedBy || undefined,
                        deletedByBusiness: Boolean(c.deletedByBusinessAt),
                        businessDeletedAt: c.deletedByBusinessAt || undefined,
                        clientDeletedAt: c.deletedForClientAt || undefined,
                        deletedForClient: Boolean(c.deletedForClientAt),
                        lastMessage: c.lastMessageText || '',
                        lastMessageTime: c.lastMessageTime || '',
                        lastMessageTimestamp: c.lastMessageTimestamp || undefined,
                        unreadCount: isBiz ? c.unreadByBusiness : c.unreadByClient,
                        unreadByClient: c.unreadByClient,
                        unreadByBusiness: c.unreadByBusiness,
                        workspaceInfo: {
                            name: c.workspaceName || 'Orqspace',
                            type: c.workspaceType || 'Orqspace Info',
                            description: c.workspaceDescription || '',
                        },
                        bookingInfo: c.bookingServiceName
                            ? {
                                serviceName: c.bookingServiceName,
                                status: c.bookingStatus || 'Active',
                            }
                            : undefined,
                        messages: [],
                    });
                }
                return result;
            }
            catch (err) {
                this.logger.error('Failed to list conversations from DB:', err);
            }
        }
        const isBiz = user.role === 'business';
        const email = user.email.toLowerCase();
        return Promise.all(this.inMemoryConversations
            .filter((c) => {
            if (isBiz) {
                return (c.businessEmail.toLowerCase() === email ||
                    c.businessId === user.id);
            }
            return (c.clientEmail.toLowerCase() === email ||
                c.clientId === user.id);
        })
            .map(async (c) => {
            const isOnline = await this.presenceService.isOnline(c.participant.email || c.participant.id);
            return {
                ...c,
                participant: {
                    ...c.participant,
                    isOnline,
                },
            };
        }));
    }
    async getConversation(conversationId, user) {
        const list = await this.listUserConversations(user);
        const conv = list.find((c) => c.id === conversationId);
        if (!conv) {
            throw new common_1.NotFoundException('Conversation not found or access denied.');
        }
        return conv;
    }
    async initiateConversation(clientUser, dto) {
        const bizEmail = dto.businessEmail.trim().toLowerCase();
        const targetBusiness = await this.authService.findUserByEmail(bizEmail);
        if (!targetBusiness) {
            throw new common_1.BadRequestException(`Business user not found for email: ${dto.businessEmail}`);
        }
        const now = Date.now();
        const timeString = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const existing = await db
                    .select()
                    .from(schema_1.conversations)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversations.clientId, clientUser.id), (0, drizzle_orm_1.eq)(schema_1.conversations.businessId, targetBusiness.id)))
                    .limit(1);
                if (existing.length > 0) {
                    const c = existing[0];
                    return this.getConversation(c.id, clientUser);
                }
                const newConvId = crypto.randomUUID();
                await db.insert(schema_1.conversations).values({
                    id: newConvId,
                    clientId: clientUser.id,
                    businessId: targetBusiness.id,
                    status: 'active',
                    workspaceName: dto.workspaceName || 'Orqspace',
                    lastMessageText: dto.initialMessage || 'Conversation started',
                    lastMessageTime: timeString,
                    lastMessageTimestamp: now,
                    unreadByClient: 0,
                    unreadByBusiness: dto.initialMessage ? 1 : 0,
                });
                await db.insert(schema_1.conversationParticipants).values([
                    {
                        id: crypto.randomUUID(),
                        conversationId: newConvId,
                        userId: clientUser.id,
                        role: 'client',
                    },
                    {
                        id: crypto.randomUUID(),
                        conversationId: newConvId,
                        userId: targetBusiness.id,
                        role: 'business',
                    },
                ]);
                return this.getConversation(newConvId, clientUser);
            }
            catch (err) {
                this.logger.error('Failed to initiate conversation in DB:', err);
            }
        }
        const newId = crypto.randomUUID();
        const newConv = {
            id: newId,
            clientId: clientUser.id,
            clientEmail: clientUser.email,
            clientName: clientUser.name,
            clientAvatar: clientUser.avatar,
            businessId: targetBusiness.id,
            businessEmail: targetBusiness.email,
            businessName: targetBusiness.name,
            businessAvatar: targetBusiness.avatar,
            participant: {
                id: targetBusiness.id,
                name: targetBusiness.name,
                email: targetBusiness.email,
                avatar: targetBusiness.avatar,
                handle: targetBusiness.handle,
                isOnline: true,
                role: 'business',
            },
            status: 'active',
            lastMessage: dto.initialMessage || 'Conversation started',
            lastMessageTime: timeString,
            lastMessageTimestamp: now,
            unreadCount: 0,
            unreadByClient: 0,
            unreadByBusiness: dto.initialMessage ? 1 : 0,
            workspaceInfo: {
                name: dto.workspaceName || 'Orqspace',
                type: 'Orqspace',
                description: 'Direct communication channel between business and client.',
            },
            messages: [],
        };
        this.inMemoryConversations.unshift(newConv);
        return newConv;
    }
    async endConversation(conversationId, user) {
        const conv = await this.getConversation(conversationId, user);
        const now = Date.now();
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                await db
                    .update(schema_1.conversations)
                    .set({
                    status: 'ended',
                    endedAt: now,
                    endedBy: user.id,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId));
                return this.getConversation(conversationId, user);
            }
            catch (err) {
                this.logger.error('Failed to end conversation in DB:', err);
            }
        }
        const target = this.inMemoryConversations.find((c) => c.id === conversationId);
        if (target) {
            target.status = 'ended';
            target.endedAt = now;
            target.endedBy = user.id;
        }
        conv.status = 'ended';
        conv.endedAt = now;
        conv.endedBy = user.id;
        return conv;
    }
    async reopenConversation(conversationId, user, dto) {
        const conv = await this.getConversation(conversationId, user);
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                await db
                    .update(schema_1.conversations)
                    .set({
                    status: 'active',
                    endedAt: null,
                    endedBy: null,
                    deletedByBusinessAt: null,
                    deletedForClientAt: null,
                    workspaceName: dto.workspaceName || conv.workspaceInfo.name,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId));
                return this.getConversation(conversationId, user);
            }
            catch (err) {
                this.logger.error('Failed to reopen conversation in DB:', err);
            }
        }
        const target = this.inMemoryConversations.find((c) => c.id === conversationId);
        if (target) {
            target.status = 'active';
            target.endedAt = undefined;
            target.endedBy = undefined;
            target.deletedByBusiness = false;
            target.deletedForClient = false;
            if (dto.workspaceName) {
                target.workspaceInfo.name = dto.workspaceName;
            }
        }
        conv.status = 'active';
        conv.endedAt = undefined;
        conv.endedBy = undefined;
        conv.deletedByBusiness = false;
        conv.deletedForClient = false;
        if (dto.workspaceName) {
            conv.workspaceInfo.name = dto.workspaceName;
        }
        return conv;
    }
    async deleteChatView(conversationId, user) {
        const conv = await this.getConversation(conversationId, user);
        const now = Date.now();
        const isBiz = user.role === 'business';
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                await db
                    .update(schema_1.conversations)
                    .set(isBiz
                    ? { deletedByBusinessAt: now, updatedAt: new Date() }
                    : { deletedForClientAt: now, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId));
                return this.getConversation(conversationId, user);
            }
            catch (err) {
                this.logger.error('Failed to delete chat view in DB:', err);
            }
        }
        const target = this.inMemoryConversations.find((c) => c.id === conversationId);
        if (target) {
            if (isBiz) {
                target.deletedByBusiness = true;
                target.businessDeletedAt = now;
            }
            else {
                target.deletedForClient = true;
                target.clientDeletedAt = now;
            }
        }
        if (isBiz) {
            conv.deletedByBusiness = true;
            conv.businessDeletedAt = now;
        }
        else {
            conv.deletedForClient = true;
            conv.clientDeletedAt = now;
        }
        return conv;
    }
    async markAsRead(conversationId, user) {
        const isBiz = user.role === 'business';
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                await db
                    .update(schema_1.conversations)
                    .set(isBiz
                    ? { unreadByBusiness: 0, updatedAt: new Date() }
                    : { unreadByClient: 0, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId));
                return;
            }
            catch (err) {
                this.logger.error('Failed to mark conversation as read in DB:', err);
            }
        }
        const conv = this.inMemoryConversations.find((c) => c.id === conversationId);
        if (conv) {
            if (isBiz) {
                conv.unreadByBusiness = 0;
            }
            else {
                conv.unreadByClient = 0;
            }
            conv.unreadCount = 0;
        }
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = ConversationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        auth_service_1.AuthService,
        presence_service_1.PresenceService])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map