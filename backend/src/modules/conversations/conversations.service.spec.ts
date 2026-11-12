import { ConversationsService } from './conversations.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { AuthService, InternalUser } from '../auth/auth.service';
import { PresenceService } from '../presence/presence.service';

describe('ConversationsService', () => {
  let conversationsService: ConversationsService;
  let dbService: DatabaseService;
  let authService: AuthService;
  let presenceService: PresenceService;

  const clientUser: InternalUser = {
    id: 'u0000000-0000-0000-0000-000000000002',
    firebaseUid: 'firebase-client-123',
    email: 'client1@orqland.test',
    name: 'Sidharth Prabhu',
    handle: '@client1',
    avatar: 'https://example.com/avatar.jpg',
    role: 'client',
  };

  const businessUser: InternalUser = {
    id: 'a0000000-0000-0000-0000-000000000001',
    firebaseUid: 'firebase-biz-123',
    email: 'workspace.alpha@orqland.test',
    name: "Sidharth Prabhu's Workspace",
    handle: '@workspace.alpha',
    avatar: 'https://example.com/avatar-biz.jpg',
    role: 'business',
  };

  beforeEach(() => {
    dbService = {
      isDbConnected: jest.fn().mockReturnValue(false),
      getDb: jest.fn(),
    } as any;

    presenceService = {
      isOnline: jest.fn().mockResolvedValue(true),
      recordHeartbeat: jest.fn(),
    } as any;

    authService = {
      findUserById: jest.fn().mockImplementation((id: string) => {
        if (id === businessUser.id) return Promise.resolve(businessUser);
        return Promise.resolve(clientUser);
      }),
      findUserByEmail: jest.fn().mockImplementation((email: string) => {
        if (email.toLowerCase() === businessUser.email.toLowerCase()) {
          return Promise.resolve(businessUser);
        }
        return Promise.resolve(clientUser);
      }),
    } as any;

    conversationsService = new ConversationsService(dbService, authService, presenceService);
  });

  it('should list conversations for client user', async () => {
    const list = await conversationsService.listUserConversations(clientUser);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].id).toBe('c0000000-0000-0000-0000-000000000001');
    expect(list[0].status).toBe('active');
  });

  it('should initiate a new conversation or return existing', async () => {
    const conv = await conversationsService.initiateConversation(clientUser, {
      businessEmail: 'workspace.alpha@orqland.test',
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
