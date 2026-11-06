"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const conversations_service_1 = require("./conversations.service");
describe('ConversationsService', () => {
    let conversationsService;
    let dbService;
    let authService;
    let presenceService;
    const clientUser = {
        id: 'u0000000-0000-0000-0000-000000000002',
        firebaseUid: 'firebase-client-123',
        email: 'ycssidharth@gmail.com',
        name: 'Sidharth Prabhu',
        handle: '@ycssidharth',
        avatar: 'https://example.com/avatar.jpg',
        role: 'client',
    };
    const businessUser = {
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
        };
        authService = {
            findUserById: jest.fn().mockImplementation((id) => {
                if (id === businessUser.id)
                    return Promise.resolve(businessUser);
                return Promise.resolve(clientUser);
            }),
            findUserByEmail: jest.fn().mockImplementation((email) => {
                if (email.toLowerCase() === businessUser.email.toLowerCase()) {
                    return Promise.resolve(businessUser);
                }
                return Promise.resolve(clientUser);
            }),
        };
        conversationsService = new conversations_service_1.ConversationsService(dbService, authService, presenceService);
    });
    it('should list conversations for client user', async () => {
        const list = await conversationsService.listUserConversations(clientUser);
        expect(list.length).toBeGreaterThan(0);
        expect(list[0].id).toBe('c0000000-0000-0000-0000-000000000001');
        expect(list[0].status).toBe('active');
    });
    it('should initiate a new conversation or return existing', async () => {
        const conv = await conversationsService.initiateConversation(clientUser, {
            businessEmail: 'mailtosidharth.me@gmail.com',
            businessName: "Sidharth Prabhu's Workspace",
            initialMessage: 'Initiating project consultation',
        });
        expect(conv).toBeDefined();
        expect(conv.status).toBe('active');
    });
    it('should end conversation session and mark it as ended', async () => {
        const convId = 'c0000000-0000-0000-0000-000000000001';
        const ended = await conversationsService.endConversation(convId, businessUser);
        expect(ended.status).toBe('ended');
        expect(ended.endedBy).toBe(businessUser.id);
    });
    it('should reopen an ended conversation session', async () => {
        const convId = 'c0000000-0000-0000-0000-000000000001';
        await conversationsService.endConversation(convId, businessUser);
        const reopened = await conversationsService.reopenConversation(convId, clientUser, {
            conversationId: convId,
            workspaceName: 'Reopened Workspace',
        });
        expect(reopened.status).toBe('active');
        expect(reopened.workspaceInfo.name).toBe('Reopened Workspace');
    });
    it('should mark unread messages as read', async () => {
        const convId = 'c0000000-0000-0000-0000-000000000001';
        await conversationsService.markAsRead(convId, clientUser);
        const conv = await conversationsService.getConversation(convId, clientUser);
        expect(conv.unreadByClient).toBe(0);
    });
});
//# sourceMappingURL=conversations.service.spec.js.map