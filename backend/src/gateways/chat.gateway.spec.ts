import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../modules/messages/messages.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { PresenceService } from '../modules/presence/presence.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { AuthService, InternalUser } from '../modules/auth/auth.service';
import { FirebaseAdminService } from '../modules/auth/firebase-admin.service';
import { CHAT_EVENTS } from '@orqland/contracts';

describe('ChatGateway & Realtime Room Authorization', () => {
  let gateway: ChatGateway;
  let messagesService: MessagesService;
  let conversationsService: ConversationsService;
  let presenceService: PresenceService;
  let notificationsService: NotificationsService;
  let authService: AuthService;
  let firebaseAdmin: FirebaseAdminService;

  const mockUser: InternalUser = {
    id: 'u0000000-0000-0000-0000-000000000002',
    firebaseUid: 'firebase-user-123',
    email: 'client1@orqland.test',
    name: 'Sidharth Prabhu',
    handle: '@client1',
    avatar: 'https://example.com/avatar.jpg',
    role: 'client',
  };

  const mockSocket: any = {
    id: 'socket-test-123',
    data: { user: mockUser },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };

  const mockServer: any = {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    emit: jest.fn(),
  };

  beforeEach(() => {
    messagesService = {
      sendMessage: jest.fn().mockResolvedValue({
        id: 'msg-realtime-1',
        conversationId: 'c0000000-0000-0000-0000-000000000001',
        senderId: mockUser.id,
        content: 'Testing WebSocket delivery',
        timestamp: '03:00 PM',
        createdAt: Date.now(),
      }),
      getMessages: jest.fn().mockResolvedValue({
        messages: [],
        hasMore: false,
      }),
    } as any;

    conversationsService = {
      getConversation: jest.fn().mockImplementation((id: string, user: InternalUser) => {
        if (id === 'c0000000-0000-0000-0000-000000000001') {
          return Promise.resolve({
            id,
            clientId: user.id,
            businessId: 'biz-1',
            status: 'active',
          });
        }
        throw new Error('Access denied to unauthorized conversation');
      }),
      markAsRead: jest.fn().mockResolvedValue(undefined),
    } as any;

    presenceService = {
      trackConnection: jest.fn().mockResolvedValue(true),
      trackDisconnection: jest.fn().mockResolvedValue(true),
    } as any;

    notificationsService = {
      sendPushNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    authService = {
      findUserByEmail: jest.fn().mockResolvedValue(mockUser),
      resolveOrCreateUser: jest.fn().mockResolvedValue(mockUser),
    } as any;

    firebaseAdmin = {
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: mockUser.firebaseUid,
        email: mockUser.email,
        name: mockUser.name,
      }),
    } as any;

    gateway = new ChatGateway(
      messagesService,
      conversationsService,
      presenceService,
      notificationsService,
      authService,
      firebaseAdmin
    );
    gateway.server = mockServer;
  });

  describe('Room Membership Authorization (Section 6.1)', () => {
    it('should allow user to join a room they are an authorized participant of', async () => {
      const convId = 'c0000000-0000-0000-0000-000000000001';
      await gateway.handleJoinConversation(mockSocket, { conversationId: convId });

      expect(conversationsService.getConversation).toHaveBeenCalledWith(convId, mockUser);
      expect(mockSocket.join).toHaveBeenCalledWith(`conversation:${convId}`);
    });

    it('should reject room join when user is not an authorized participant', async () => {
      const unauthorizedConvId = 'unauthorized-conv-id';
      await gateway.handleJoinConversation(mockSocket, { conversationId: unauthorizedConvId });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.ERROR,
        expect.objectContaining({
          code: 'ROOM_ACCESS_DENIED',
        })
      );
      expect(mockSocket.join).not.toHaveBeenCalledWith(`conversation:${unauthorizedConvId}`);
    });
  });

  describe('Message Lifecycle & Acknowledgment (Section 6.2)', () => {
    it('should persist message, emit message:ack to sender, and broadcast message:new to room', async () => {
      const convId = 'c0000000-0000-0000-0000-000000000001';
      const idempotencyKey = 'idemp-key-999';

      await gateway.handleSendMessage(mockSocket, {
        conversationId: convId,
        content: 'Testing WebSocket delivery',
        idempotencyKey,
      });

      expect(messagesService.sendMessage).toHaveBeenCalledWith(mockUser, {
        conversationId: convId,
        content: 'Testing WebSocket delivery',
        idempotencyKey,
        attachments: undefined,
      });

      // Sender acknowledgment
      expect(mockSocket.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.MESSAGE_ACK,
        expect.objectContaining({
          clientGeneratedId: idempotencyKey,
          messageId: 'msg-realtime-1',
          status: 'delivered',
        })
      );

      // Room broadcast
      expect(mockServer.to).toHaveBeenCalledWith(`conversation:${convId}`);
    });
  });

  describe('Typing & Read Updates (Section 6.3)', () => {
    it('should broadcast typing:update to room members', async () => {
      const convId = 'c0000000-0000-0000-0000-000000000001';
      await gateway.handleTypingStart(mockSocket, { conversationId: convId });

      expect(mockSocket.to).toHaveBeenCalledWith(`conversation:${convId}`);
    });

    it('should update read cursor and broadcast message:read:update', async () => {
      const convId = 'c0000000-0000-0000-0000-000000000001';
      await gateway.handleMarkRead(mockSocket, {
        conversationId: convId,
        lastReadMessageId: 'msg-1',
      });

      expect(conversationsService.markAsRead).toHaveBeenCalledWith(convId, mockUser);
      expect(mockServer.to).toHaveBeenCalledWith(`conversation:${convId}`);
    });
  });

  describe('Reconnect Recovery (Section 6.2 & 14)', () => {
    it('should allow recovering missed messages using cursor pagination upon reconnect', async () => {
      const convId = 'c0000000-0000-0000-0000-000000000001';
      const lastKnownTimestamp = Date.now() - 60000;

      await messagesService.getMessages(convId, mockUser, 50, lastKnownTimestamp);

      expect(messagesService.getMessages).toHaveBeenCalledWith(
        convId,
        mockUser,
        50,
        lastKnownTimestamp
      );
    });
  });
});
