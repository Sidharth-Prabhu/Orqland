"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messages_service_1 = require("./messages.service");
const conversations_service_1 = require("../conversations/conversations.service");
const common_1 = require("@nestjs/common");
describe('MessagesService', () => {
    let messagesService;
    let conversationsService;
    let dbService;
    let authService;
    let presenceService;
    const mockClientUser = {
        id: 'u0000000-0000-0000-0000-000000000002',
        firebaseUid: 'firebase-client-123',
        email: 'ycssidharth@gmail.com',
        name: 'Sidharth Prabhu',
        handle: '@ycssidharth',
        avatar: 'https://example.com/avatar.jpg',
        role: 'client',
    };
    const mockBusinessUser = {
        id: 'a0000000-0000-0000-0000-000000000001',
        firebaseUid: 'firebase-biz-123',
        email: 'mailtosidharth.me@gmail.com',
        name: "Sidharth Prabhu's Workspace",
        handle: '@mailtosidharth.me',
        avatar: 'https://example.com/avatar-biz.jpg',
        role: 'business',
    };
    beforeEach(() => {
        dbService = {
            isDbConnected: jest.fn().mockReturnValue(false),
            getDb: jest.fn(),
        };
        presenceService = {
            isOnline: jest.fn().mockResolvedValue(true),
            recordHeartbeat: jest.fn(),
            trackConnection: jest.fn().mockResolvedValue(true),
            trackDisconnection: jest.fn().mockResolvedValue(true),
        };
        authService = {
            findUserById: jest.fn().mockImplementation((id) => {
                if (id === mockBusinessUser.id)
                    return Promise.resolve(mockBusinessUser);
                return Promise.resolve(mockClientUser);
            }),
            findUserByEmail: jest.fn().mockImplementation((email) => {
                if (email === mockBusinessUser.email)
                    return Promise.resolve(mockBusinessUser);
                return Promise.resolve(mockClientUser);
            }),
        };
        conversationsService = new conversations_service_1.ConversationsService(dbService, authService, presenceService);
        messagesService = new messages_service_1.MessagesService(dbService, conversationsService);
    });
    describe('sendMessage', () => {
        it('should successfully send a message and update lastMessage', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            const msg = await messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Hello team, testing production architecture!',
            });
            expect(msg).toBeDefined();
            expect(msg.content).toBe('Hello team, testing production architecture!');
            expect(msg.senderId).toBe(mockClientUser.id);
            expect(msg.conversationId).toBe(convId);
            expect(msg.status).toBe('delivered');
        });
        it('should enforce idempotency and not create duplicates for same key', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            const idempotencyKey = 'unique-key-xyz-123';
            const firstCall = await messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Idempotency test payload',
                idempotencyKey,
            });
            const secondCall = await messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Idempotency test payload retry',
                idempotencyKey,
            });
            expect(firstCall.id).toBe(secondCall.id);
            expect(secondCall.content).toBe('Idempotency test payload');
        });
        it('should block messages containing sensitive DLP patterns (SSN)', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            await expect(messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Here is my SSN: 123-45-6789 please keep it safe',
            })).rejects.toThrow(common_1.BadRequestException);
        });
        it('should prevent sending messages when conversation session is ended', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            await conversationsService.endConversation(convId, mockBusinessUser);
            await expect(messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Attempting to send after chat ended',
            })).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('editMessage and deleteMessage', () => {
        it('should allow author to edit a message within 10 minutes', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            const msg = await messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Initial text before edit',
            });
            const edited = await messagesService.editMessage(mockClientUser, {
                conversationId: convId,
                messageId: msg.id,
                content: 'Updated text after edit',
            });
            expect(edited.content).toBe('Updated text after edit');
            expect(edited.isEdited).toBe(true);
        });
        it('should forbid editing someone else’s message', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            const msg = await messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Sent by client',
            });
            await expect(messagesService.editMessage(mockBusinessUser, {
                conversationId: convId,
                messageId: msg.id,
                content: 'Hacked by someone else',
            })).rejects.toThrow(common_1.ForbiddenException);
        });
        it('should allow author to delete a message within 15 minutes', async () => {
            const convId = 'c0000000-0000-0000-0000-000000000001';
            const msg = await messagesService.sendMessage(mockClientUser, {
                conversationId: convId,
                content: 'Message to be deleted',
            });
            const deleted = await messagesService.deleteMessage(mockClientUser, {
                conversationId: convId,
                messageId: msg.id,
            });
            expect(deleted.deletedForEveryone).toBe(true);
            expect(deleted.content).toBe('This message was deleted');
        });
    });
});
//# sourceMappingURL=messages.service.spec.js.map