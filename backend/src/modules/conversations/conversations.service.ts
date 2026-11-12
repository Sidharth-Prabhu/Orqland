import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  chatConversations,
  orqspaces,
  orqUsers,
  chatMessages,
  chatMessageReceipts,
} from '../../infrastructure/database/schema';
import { InternalUser, AuthService } from '../auth/auth.service';
import { PresenceService } from '../presence/presence.service';
import { MessagesService } from '../messages/messages.service';
import {
  Conversation,
  ChatMessage,
  InitiateConversationDto,
  ReopenConversationDto,
} from '@orqland/contracts';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import * as crypto from 'crypto';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  // In-memory conversation store for development fallback when Postgres is not running
  private inMemoryConversations: Conversation[] = [];

  constructor(
    private readonly dbService: DatabaseService,
    private readonly authService: AuthService,
    private readonly presenceService: PresenceService,
    @Optional()
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService?: MessagesService
  ) {
    this.seedDevConversations();
  }

  private seedDevConversations() {
    this.inMemoryConversations = [
      {
        id: 'c0000000-0000-0000-0000-000000000001',
        clientId: 'u0000000-0000-0000-0000-000000000002',
        clientEmail: 'client1@orqland.test',
        clientName: 'Alice Client',
        clientAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
        businessId: 'a0000000-0000-0000-0000-000000000001',
        businessEmail: 'workspace.alpha@orqland.test',
        businessName: 'Alpha Strategic Workspace',
        businessAvatar: '',
        participant: {
          id: 'a0000000-0000-0000-0000-000000000001',
          name: 'Alpha Strategic Workspace',
          email: 'workspace.alpha@orqland.test',
          avatar: '',
          handle: '@workspace.alpha',
          isOnline: true,
          role: 'business',
        },
        status: 'active',
        lastMessage: 'Welcome to Alpha Strategic Workspace.',
        lastMessageTime: '02:51 PM',
        lastMessageTimestamp: Date.now() - 3600000,
        unreadCount: 0,
        workspaceInfo: {
          name: 'Alpha Strategic Workspace',
          type: 'Orqspace',
          description: 'Official workspace for technology architecture, software engineering, and strategic advisory.',
        },
        messages: [],
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccc0001',
        clientId: '11111111-1111-1111-1111-111111111111',
        clientEmail: 'client1@orqland.test',
        clientName: 'Alice Client',
        clientAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
        businessId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        businessEmail: 'workspace.alpha@orqland.test',
        businessName: 'Alpha Strategic Workspace',
        businessAvatar: '',
        participant: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'Alpha Strategic Workspace',
          email: 'workspace.alpha@orqland.test',
          avatar: '',
          handle: '@workspace.alpha',
          isOnline: true,
          role: 'business',
        },
        status: 'active',
        lastMessage: 'Welcome to Alpha Strategic Workspace.',
        lastMessageTime: '02:51 PM',
        lastMessageTimestamp: Date.now() - 3600000,
        unreadCount: 0,
        workspaceInfo: {
          name: 'Alpha Strategic Workspace',
          type: 'Orqspace',
          description: 'Official workspace for technology architecture, software engineering, and strategic advisory.',
        },
        messages: [],
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccc0002',
        clientId: '11111111-1111-1111-1111-111111111111',
        clientEmail: 'client1@orqland.test',
        clientName: 'Alice Client',
        clientAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
        businessId: 'a0000000-0000-0000-0000-000000000002',
        businessEmail: 'tech@orqland.com',
        businessName: 'Orqland Tech Solutions',
        businessAvatar: '',
        participant: {
          id: 'a0000000-0000-0000-0000-000000000002',
          name: 'Orqland Tech Solutions',
          email: 'tech@orqland.com',
          avatar: '',
          handle: '@tech',
          isOnline: true,
          role: 'business',
        },
        status: 'active',
        lastMessage: 'Cloud infrastructure consultation.',
        lastMessageTime: '01:15 PM',
        lastMessageTimestamp: Date.now() - 7200000,
        unreadCount: 0,
        workspaceInfo: {
          name: 'Orqland Tech Solutions',
          type: 'Orqspace',
          description: 'Full-stack cloud infrastructure and DevOps pipelines.',
        },
        messages: [],
      },
    ];
  }

  /**
   * List all conversations for the authenticated user (client or workspace owner)
   */
  async listUserConversations(user: InternalUser): Promise<Conversation[]> {
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();

        // Multi-tenant resolution: conversations where user is client OR owner of workspace
        const convRows = await db
          .select({
            conv: chatConversations,
            client: orqUsers,
            space: orqspaces,
          })
          .from(chatConversations)
          .innerJoin(orqUsers, eq(chatConversations.clientUserId, orqUsers.id))
          .innerJoin(orqspaces, eq(chatConversations.orqspaceId, orqspaces.id))
          .where(
            or(
              eq(chatConversations.clientUserId, user.id),
              eq(orqspaces.ownerId, user.id)
            )
          )
          .orderBy(desc(chatConversations.lastMessageAt));

        const result: Conversation[] = [];

        for (const row of convRows) {
          const c = row.conv;
          const isOwner = row.space.ownerId === user.id;
          const otherUserId = isOwner ? row.client.id : row.space.id;
          const otherUserName = isOwner ? row.client.displayName || 'Client' : row.space.name;
          const otherUserEmail = isOwner ? row.client.email || '' : '';
          const otherAvatar = isOwner ? row.client.avatar || '' : row.space.logoUrl || '';

          const isOtherOnline = await this.presenceService.isOnline(otherUserId);
          const lastMsgTimestamp = c.lastMessageAt ? c.lastMessageAt.getTime() : c.createdAt.getTime();
          const lastMsgTime = new Date(lastMsgTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          result.push({
            id: c.id,
            clientId: row.client.id,
            clientEmail: row.client.email || '',
            clientName: row.client.displayName || 'Client',
            clientAvatar: row.client.avatar || '',
            businessId: row.space.id,
            businessEmail: row.space.name,
            businessName: row.space.name,
            businessAvatar: row.space.logoUrl || '',
            participant: {
              id: otherUserId,
              name: otherUserName,
              email: otherUserEmail,
              avatar: otherAvatar,
              handle: otherUserEmail ? `@${otherUserEmail.split('@')[0]}` : `@${row.space.orqspaceCode}`,
              isOnline: isOtherOnline,
              role: isOwner ? 'client' : 'business',
            },
            status: c.status as 'active' | 'ended',
            endedAt: c.endedAt ? c.endedAt.getTime() : undefined,
            endedBy: c.endedByUserId || undefined,
            deletedForClient: Boolean(c.clientClearedBefore),
            deletedByBusiness: Boolean(c.workspaceClearedBefore),
            lastMessage: c.lastMessagePreview || '',
            lastMessageTime: lastMsgTime,
            lastMessageTimestamp: lastMsgTimestamp,
            unreadCount: isOwner ? c.unreadByWorkspace : c.unreadByClient,
            unreadByClient: c.unreadByClient,
            unreadByBusiness: c.unreadByWorkspace,
            workspaceInfo: {
              name: row.space.name,
              type: 'Orqspace',
              description: `Workspace code: ${row.space.orqspaceCode}`,
            },
            messages: [],
          });
        }

        return result;
      } catch (err) {
        this.logger.error('Failed to list conversations from DB:', err);
        throw new InternalServerErrorException('Database failure while querying conversations. Failed closed.');
      }
    }

    // In-memory fallback
    const isBiz = user.role === 'business';
    const email = user.email.toLowerCase();

    return Promise.all(
      this.inMemoryConversations
        .filter((c) => {
          if (isBiz) {
            return (
              c.businessEmail.toLowerCase() === email ||
              c.businessId === user.id ||
              ((email === 'mailtosidharth.me@gmail.com' || email === 'workspace.alpha@orqland.test') &&
                (c.businessEmail === 'workspace.alpha@orqland.test' || c.businessEmail === 'mailtosidharth.me@gmail.com'))
            );
          }
          return (
            c.clientEmail.toLowerCase() === email ||
            c.clientId === user.id ||
            ((email === 'client1@orqland.test' || email === 'ycssidharth@gmail.com') &&
              (c.clientEmail === 'client1@orqland.test' || c.clientEmail === 'ycssidharth@gmail.com'))
          );
        })
        .map(async (c) => {
          const isOtherBiz = !isBiz;
          const otherEmail = isBiz ? c.clientEmail : c.businessEmail;
          const otherId = isBiz ? c.clientId : c.businessId;
          const otherName = isBiz ? c.clientName : c.businessName;
          const otherAvatar = isBiz ? c.clientAvatar : c.businessAvatar;

          const isOnline = await this.presenceService.isOnline(otherId);
          const convMessages = this.messagesService?.getInMemoryMessagesForConversation(c.id) || [];
          const unreadCount = isBiz ? (c.unreadByBusiness || 0) : (c.unreadByClient || 0);

          return {
            ...c,
            unreadCount,
            unreadByClient: c.unreadByClient ?? 0,
            unreadByBusiness: c.unreadByBusiness ?? 0,
            participant: {
              id: otherId,
              name: otherName || (isBiz ? 'Client' : 'Business'),
              email: otherEmail,
              avatar: otherAvatar || '',
              handle: otherEmail ? `@${otherEmail.split('@')[0]}` : '@user',
              isOnline,
              role: isOtherBiz ? 'business' : 'client',
            },
            messages: convMessages,
          };
        })
    );
  }

  /**
   * Get single conversation by ID with membership / authorization check
   */
  async getConversation(conversationId: string, user: InternalUser): Promise<Conversation> {
    const list = await this.listUserConversations(user);
    let conv = list.find((c) => c.id === conversationId);
    if (!conv && !this.dbService.isDbConnected()) {
      conv = this.inMemoryConversations.find((c) => c.id === conversationId);
    }
    if (!conv) {
      throw new NotFoundException('Conversation not found or access denied.');
    }
    return conv;
  }

  /**
   * Initiate a conversation (Client initiates with Workspace)
   */
  async initiateConversation(
    clientUser: InternalUser,
    dto: InitiateConversationDto
  ): Promise<Conversation> {
    const bizTarget = (dto.businessEmail || (dto as any).businessId || '').trim();
    let targetWorkspaceId = (dto as any).businessId;

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();

        // 1. Resolve workspace from orqspaces
        let spaceRows = await db
          .select()
          .from(orqspaces)
          .where(
            or(
              eq(orqspaces.id, targetWorkspaceId || crypto.randomUUID()),
              eq(orqspaces.orqspaceCode, bizTarget)
            )
          )
          .limit(1);

        if (spaceRows.length === 0) {
          // Check if any workspace exists, or create a default orqspace for this business
          const allSpaces = await db.select().from(orqspaces).limit(1);
          if (allSpaces.length > 0) {
            spaceRows = allSpaces;
          } else {
            const newSpaceId = targetWorkspaceId || crypto.randomUUID();
            await db.insert(orqspaces).values({
              id: newSpaceId,
              orqspaceCode: 'WS#ALPHA#01',
              name: dto.businessName || 'Alpha Strategic Workspace',
              logoUrl: dto.businessAvatar || '',
              ownerId: clientUser.id,
              isActive: true,
            });
            spaceRows = await db.select().from(orqspaces).where(eq(orqspaces.id, newSpaceId)).limit(1);
          }
        }

        const space = spaceRows[0];

        // 2. Enforce single thread per (clientUserId, orqspaceId) pair
        const existing = await db
          .select()
          .from(chatConversations)
          .where(
            and(
              eq(chatConversations.clientUserId, clientUser.id),
              eq(chatConversations.orqspaceId, space.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          if (dto.initialMessage && dto.initialMessage.trim() && this.messagesService) {
            await this.messagesService.sendMessage(clientUser, {
              conversationId: existing[0].id,
              content: dto.initialMessage.trim(),
            });
          }
          return this.getConversation(existing[0].id, clientUser);
        }

        const newConvId = crypto.randomUUID();
        const now = new Date();

        await db.insert(chatConversations).values({
          id: newConvId,
          clientUserId: clientUser.id,
          orqspaceId: space.id,
          status: 'active',
          lastMessagePreview: dto.initialMessage || 'Conversation started',
          lastMessageAt: now,
          unreadByClient: 0,
          unreadByWorkspace: dto.initialMessage ? 1 : 0,
        });

        if (dto.initialMessage && dto.initialMessage.trim() && this.messagesService) {
          await this.messagesService.sendMessage(clientUser, {
            conversationId: newConvId,
            content: dto.initialMessage.trim(),
          });
        }

        return this.getConversation(newConvId, clientUser);
      } catch (err) {
        this.logger.error('Failed to initiate conversation in DB:', err);
        throw new InternalServerErrorException('Database failure while initiating conversation. Failed closed.');
      }
    }

    // In-memory fallback
    const targetBusiness = await this.authService.findUserByEmail(bizTarget) || {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'workspace.alpha@orqland.test',
      name: 'Alpha Strategic Workspace',
      avatar: '',
      handle: '@workspace.alpha',
      role: 'business' as const,
      firebaseUid: 'dev-workspace-alpha',
    };

    const existingMemory = this.inMemoryConversations.find(
      (c) =>
        (c.clientId === clientUser.id || c.clientEmail.toLowerCase() === clientUser.email.toLowerCase()) &&
        (c.businessId === targetBusiness.id || c.businessEmail.toLowerCase() === targetBusiness.email.toLowerCase())
    );

    if (existingMemory) {
      if (dto.initialMessage && dto.initialMessage.trim() && this.messagesService) {
        await this.messagesService.sendMessage(clientUser, {
          conversationId: existingMemory.id,
          content: dto.initialMessage.trim(),
        });
      }
      return this.getConversation(existingMemory.id, clientUser);
    }

    const now = Date.now();
    const timeString = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newId = crypto.randomUUID();

    const newConv: Conversation = {
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
        name: dto.workspaceName || targetBusiness.name,
        type: 'Orqspace',
        description: 'Direct communication channel between business workspace and client.',
      },
      messages: [],
    };

    if (dto.initialMessage && dto.initialMessage.trim()) {
      const initMsg: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId: newId,
        senderId: clientUser.id,
        senderEmail: clientUser.email,
        senderName: clientUser.name,
        senderAvatar: clientUser.avatar,
        content: dto.initialMessage.trim(),
        timestamp: timeString,
        date: 'Today',
        createdAt: now,
        isMe: true,
        status: 'delivered',
      };
      newConv.messages = [initMsg];
      this.messagesService?.addInMemoryMessage(initMsg);
    }

    this.inMemoryConversations.unshift(newConv);
    return newConv;
  }

  /**
   * End a conversation session (closes session and rejects future messages)
   */
  async endConversation(conversationId: string, user: InternalUser): Promise<Conversation> {
    const conv = await this.getConversation(conversationId, user);
    const now = new Date();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(chatConversations)
          .set({
            status: 'ended',
            endedAt: now,
            endedByUserId: user.id,
            updatedAt: now,
          })
          .where(eq(chatConversations.id, conversationId));

        return this.getConversation(conversationId, user);
      } catch (err) {
        this.logger.error('Failed to end conversation in DB:', err);
        throw new InternalServerErrorException('Database failure while ending conversation. Failed closed.');
      }
    }

    // In-memory fallback
    const target = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (target) {
      target.status = 'ended';
      target.endedAt = now.getTime();
      target.endedBy = user.id;
    }
    conv.status = 'ended';
    conv.endedAt = now.getTime();
    conv.endedBy = user.id;
    return conv;
  }

  /**
   * Reopen an ended conversation session
   */
  async reopenConversation(
    conversationId: string,
    user: InternalUser,
    dto: ReopenConversationDto
  ): Promise<Conversation> {
    const conv = await this.getConversation(conversationId, user);
    const now = new Date();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(chatConversations)
          .set({
            status: 'active',
            endedAt: null,
            endedByUserId: null,
            updatedAt: now,
          })
          .where(eq(chatConversations.id, conversationId));

        return this.getConversation(conversationId, user);
      } catch (err) {
        this.logger.error('Failed to reopen conversation in DB:', err);
        throw new InternalServerErrorException('Database failure while reopening conversation. Failed closed.');
      }
    }

    // In-memory fallback
    const target = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (target) {
      target.status = 'active';
      target.endedAt = undefined;
      target.endedBy = undefined;
      target.deletedByBusiness = false;
      target.deletedForClient = false;
      if (dto?.workspaceName) {
        target.workspaceInfo = {
          ...target.workspaceInfo,
          name: dto.workspaceName,
        };
      }
      return target;
    }
    conv.status = 'active';
    conv.endedAt = undefined;
    conv.endedBy = undefined;
    conv.deletedByBusiness = false;
    conv.deletedForClient = false;
    if (dto?.workspaceName) {
      conv.workspaceInfo = {
        ...conv.workspaceInfo,
        name: dto.workspaceName,
      };
    }
    return conv;
  }

  /**
   * Clear conversation history on user's side (watermark filter)
   */
  async deleteChatView(conversationId: string, user: InternalUser): Promise<Conversation> {
    const conv = await this.getConversation(conversationId, user);
    const now = new Date();
    const isClient = user.id === conv.clientId;

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(chatConversations)
          .set(
            isClient
              ? { clientClearedBefore: now, updatedAt: now }
              : { workspaceClearedBefore: now, updatedAt: now }
          )
          .where(eq(chatConversations.id, conversationId));

        return this.getConversation(conversationId, user);
      } catch (err) {
        this.logger.error('Failed to clear conversation history in DB:', err);
        throw new InternalServerErrorException('Database failure while updating chat history. Failed closed.');
      }
    }

    // In-memory fallback
    const target = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (target) {
      if (isClient) {
        target.deletedForClient = true;
        target.clientDeletedAt = now.getTime();
      } else {
        target.deletedByBusiness = true;
        target.businessDeletedAt = now.getTime();
      }
    }
    return conv;
  }

  /**
   * Mark messages in conversation as read with IDOR protection and receipt recording
   */
  async markAsRead(conversationId: string, user: InternalUser, lastReadMessageId?: string): Promise<void> {
    // 1. Strict participant verification (IDOR protection)
    const conv = await this.getConversation(conversationId, user);
    const userEmailNorm = (user.email || '').toLowerCase().trim();
    const isClient = user.role === 'client' || user.id === conv.clientId || userEmailNorm === (conv.clientEmail || '').toLowerCase().trim();
    const now = new Date();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(chatConversations)
          .set(
            isClient
              ? { unreadByClient: 0, updatedAt: now }
              : { unreadByWorkspace: 0, updatedAt: now }
          )
          .where(eq(chatConversations.id, conversationId));

        // Mark messages read in database
        await db
          .update(chatMessages)
          .set({ status: 'read' })
          .where(
            and(
              eq(chatMessages.conversationId, conversationId),
              sql`${chatMessages.senderUserId} != ${user.id}`
            )
          );

        // Record per-participant receipt
        if (lastReadMessageId) {
          await db
            .insert(chatMessageReceipts)
            .values({
              id: crypto.randomUUID(),
              conversationId,
              userId: user.id,
              lastReadMessageId,
              lastReadAt: now,
            })
            .onConflictDoUpdate({
              target: [chatMessageReceipts.conversationId, chatMessageReceipts.userId],
              set: {
                lastReadMessageId,
                lastReadAt: now,
              },
            });
        }

        this.messagesService?.markMessagesAsRead(conversationId, user.id, user.email);
        return;
      } catch (err) {
        this.logger.error('Failed to mark conversation as read in DB:', err);
        throw new InternalServerErrorException('Database failure while marking conversation as read. Failed closed.');
      }
    }

    // In-memory fallback
    const memConv = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (memConv) {
      if (isClient) {
        memConv.unreadByClient = 0;
      } else {
        memConv.unreadByBusiness = 0;
      }
      memConv.unreadCount = 0;
      if (lastReadMessageId) {
        memConv.participant.lastReadMessageId = lastReadMessageId;
        memConv.participant.lastReadAt = Date.now();
      }
    }
    if (isClient) {
      conv.unreadByClient = 0;
    } else {
      conv.unreadByBusiness = 0;
    }
    conv.unreadCount = 0;
    if (lastReadMessageId) {
      conv.participant.lastReadMessageId = lastReadMessageId;
      conv.participant.lastReadAt = Date.now();
    }
    this.messagesService?.markMessagesAsRead(conversationId, user.id, user.email);
  }

  /**
   * Helper method for MessagesService to update the conversation summary in memory
   */
  updateInMemoryConversationLastMessage(
    conversationId: string,
    lastMessage: string,
    timestamp: number,
    senderRole: 'client' | 'business'
  ) {
    const conv = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = lastMessage;
      conv.lastMessageTimestamp = timestamp;
      conv.lastMessageTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (senderRole === 'client') {
        conv.unreadByBusiness = (conv.unreadByBusiness || 0) + 1;
      } else {
        conv.unreadByClient = (conv.unreadByClient || 0) + 1;
      }
    }
  }
}
