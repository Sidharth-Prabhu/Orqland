import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  CHAT_EVENTS,
  JoinConversationPayload,
  LeaveConversationPayload,
  SendMessagePayload,
  MarkReadPayload,
  TypingPayload,
  ChatMessage,
} from '@orqland/contracts';
import { MessagesService } from '../modules/messages/messages.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { PresenceService } from '../modules/presence/presence.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { AuthService, InternalUser } from '../modules/auth/auth.service';
import { FirebaseAdminService } from '../modules/auth/firebase-admin.service';

import { WsAuthGuard } from '../common/guards/ws-auth.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@UseGuards(WsAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly presenceService: PresenceService,
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
    private readonly firebaseAdmin: FirebaseAdminService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization;

      if (!token) {
        this.logger.warn(`WS connection rejected: Missing token from client ${client.id}`);
        client.emit(CHAT_EVENTS.ERROR, {
          code: 'UNAUTHORIZED',
          message: 'Authentication token required for WebSocket connection.',
        });
        client.disconnect(true);
        return;
      }

      const decoded = await this.firebaseAdmin.verifyIdToken(token);
      const user = await this.authService.resolveOrCreateUser(decoded);
      client.data.user = user;

      // Join personal room and email room for targeted alerts and cross-room events
      await client.join(`user:${user.id}`);
      if (user.email) {
        await client.join(`user:email:${user.email.toLowerCase()}`);
      }

      // Track online presence
      const becameOnline = await this.presenceService.trackConnection(user.id, client.id);
      if (becameOnline) {
        this.server.emit(CHAT_EVENTS.PRESENCE_UPDATE, {
          userId: user.id,
          userEmail: user.email,
          isOnline: true,
          timestamp: Date.now(),
        });
      }

      this.logger.log(`WS Client connected: ${client.id} (User: ${user.email})`);
    } catch (err: any) {
      this.logger.error(`WS Authentication failed for ${client.id}:`, err?.message);
      client.emit(CHAT_EVENTS.ERROR, {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired WebSocket handshake token.',
      });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user: InternalUser | undefined = client.data?.user;
    if (user) {
      const wentOffline = await this.presenceService.trackDisconnection(user.id, client.id);
      if (wentOffline) {
        this.server.emit(CHAT_EVENTS.PRESENCE_UPDATE, {
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

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_JOIN)
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinConversationPayload
  ) {
    const user: InternalUser = client.data.user;
    if (!user || !payload?.conversationId) return;

    try {
      // Membership verification
      await this.conversationsService.getConversation(payload.conversationId, user);
      await client.join(`conversation:${payload.conversationId}`);
      this.logger.log(`User ${user.email} joined room conversation:${payload.conversationId}`);
    } catch (err: any) {
      client.emit(CHAT_EVENTS.ERROR, {
        code: 'ROOM_ACCESS_DENIED',
        message: err.message,
      });
    }
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_LEAVE)
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveConversationPayload
  ) {
    if (!payload?.conversationId) return;
    await client.leave(`conversation:${payload.conversationId}`);
  }

  /**
   * Broadcast message to conversation and direct recipient user room, and trigger push notification
   */
  async broadcastNewMessage(createdMessage: ChatMessage, sender: InternalUser) {
    // 1. Broadcast to conversation room
    this.server.to(`conversation:${createdMessage.conversationId}`).emit(CHAT_EVENTS.MESSAGE_NEW, {
      ...createdMessage,
      isMe: false,
    });

    try {
      const conv = await this.conversationsService.getConversation(createdMessage.conversationId, sender);
      const otherParticipantId = conv.clientId === sender.id ? conv.businessId : conv.clientId;
      const otherParticipantEmail =
        conv.clientId === sender.id ? conv.businessEmail : conv.clientEmail;

      // 2. Broadcast to recipient personal room & email room (guarantees delivery if recipient is minimized/in another tab)
      if (otherParticipantId) {
        this.server.to(`user:${otherParticipantId}`).emit(CHAT_EVENTS.MESSAGE_NEW, {
          ...createdMessage,
          isMe: false,
        });

        // 3. Emit conversation updated event to conversation room and recipient user room
        const convUpdatePayload = {
          conversationId: createdMessage.conversationId,
          lastMessage: createdMessage.content,
          lastMessageTime: createdMessage.timestamp,
          lastMessageTimestamp: createdMessage.createdAt,
        };
        this.server.to(`conversation:${createdMessage.conversationId}`).emit(CHAT_EVENTS.CONVERSATION_UPDATED, convUpdatePayload);
        this.server.to(`user:${otherParticipantId}`).emit(CHAT_EVENTS.CONVERSATION_UPDATED, convUpdatePayload);

        if (otherParticipantEmail) {
          this.server.to(`user:email:${otherParticipantEmail.toLowerCase()}`).emit(CHAT_EVENTS.MESSAGE_NEW, {
            ...createdMessage,
            isMe: false,
          });
          this.server.to(`user:email:${otherParticipantEmail.toLowerCase()}`).emit(CHAT_EVENTS.CONVERSATION_UPDATED, convUpdatePayload);
        }

        // 4. Trigger push notification for other participant
        await this.notificationsService.sendPushNotification({
          recipientUserId: otherParticipantId,
          recipientEmail: otherParticipantEmail,
          senderName: sender.name,
          conversationId: createdMessage.conversationId,
          hasAttachment: Boolean(createdMessage.attachments && createdMessage.attachments.length > 0),
        });
      }
    } catch (e: any) {
      this.logger.error(`Error in broadcastNewMessage: ${e?.message}`);
    }
  }

  /**
   * Broadcast message edit to conversation room
   */
  broadcastMessageEdited(conversationId: string, editedMessage: ChatMessage) {
    this.server.to(`conversation:${conversationId}`).emit(CHAT_EVENTS.MESSAGE_EDITED, {
      conversationId,
      messageId: editedMessage.id,
      content: editedMessage.content,
      isEdited: true,
      editedAt: editedMessage.editedAt || Date.now(),
    });
  }

  /**
   * Broadcast message deletion to conversation room
   */
  broadcastMessageDeleted(conversationId: string, messageId: string) {
    this.server.to(`conversation:${conversationId}`).emit(CHAT_EVENTS.MESSAGE_DELETED, {
      conversationId,
      messageId,
      deletedForEveryone: true,
      deletedAt: Date.now(),
    });
  }

  /**
   * Broadcast read update to conversation room
   */
  broadcastMessageRead(conversationId: string, userId: string, lastReadMessageId?: string) {
    this.server.to(`conversation:${conversationId}`).emit(CHAT_EVENTS.MESSAGE_READ_UPDATE, {
      conversationId,
      userId,
      lastReadMessageId,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast conversation updated event (e.g. ended, reopened, or updated)
   * Broadcasts to conversation room as well as recipient and personal rooms so background clients receive instant sync
   */
  async broadcastConversationUpdated(conversationId: string, payload: any) {
    this.server.to(`conversation:${conversationId}`).emit(CHAT_EVENTS.CONVERSATION_UPDATED, {
      conversationId,
      ...payload,
    });

    try {
      if (payload?.participantId) {
        this.server.to(`user:${payload.participantId}`).emit(CHAT_EVENTS.CONVERSATION_UPDATED, {
          conversationId,
          ...payload,
        });
      }
      if (payload?.participantEmail) {
        this.server.to(`user:email:${payload.participantEmail.toLowerCase()}`).emit(CHAT_EVENTS.CONVERSATION_UPDATED, {
          conversationId,
          ...payload,
        });
      }
    } catch {}
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_SEND)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload
  ) {
    const user: InternalUser = client.data.user;
    if (!user) {
      client.emit(CHAT_EVENTS.ERROR, { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    try {
      const createdMessage = await this.messagesService.sendMessage(user, {
        conversationId: payload.conversationId,
        content: payload.content,
        idempotencyKey: payload.idempotencyKey,
        attachments: payload.attachments as any,
      });

      // 1. Send immediate ACK back to the sender
      client.emit(CHAT_EVENTS.MESSAGE_ACK, {
        clientGeneratedId: payload.idempotencyKey,
        messageId: createdMessage.id,
        status: 'delivered',
        createdAt: createdMessage.createdAt,
      });

      // 2. Broadcast and notify via shared helper
      await this.broadcastNewMessage(createdMessage, user);
    } catch (err: any) {
      this.logger.error(`Failed to handle message:send: ${err?.message}`);
      client.emit(CHAT_EVENTS.ERROR, {
        code: err?.response?.errorCode || 'MESSAGE_SEND_FAILED',
        message: err?.message || 'Failed to send message',
      });
    }
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadPayload
  ) {
    const user: InternalUser = client.data.user;
    if (!user || !payload?.conversationId) return;

    try {
      await this.conversationsService.markAsRead(payload.conversationId, user);
      // Broadcast read receipt to conversation room
      this.server.to(`conversation:${payload.conversationId}`).emit(CHAT_EVENTS.MESSAGE_READ_UPDATE, {
        conversationId: payload.conversationId,
        userId: user.id,
        readAt: Date.now(),
        lastReadMessageId: payload.lastReadMessageId,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to mark as read: ${err?.message}`);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload
  ) {
    const user: InternalUser = client.data.user;
    if (!user || !payload?.conversationId) return;

    client.to(`conversation:${payload.conversationId}`).emit(CHAT_EVENTS.TYPING_UPDATE, {
      conversationId: payload.conversationId,
      userId: user.id,
      userName: user.name,
      isTyping: true,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload
  ) {
    const user: InternalUser = client.data.user;
    if (!user || !payload?.conversationId) return;

    client.to(`conversation:${payload.conversationId}`).emit(CHAT_EVENTS.TYPING_UPDATE, {
      conversationId: payload.conversationId,
      userId: user.id,
      userName: user.name,
      isTyping: false,
    });
  }
}
