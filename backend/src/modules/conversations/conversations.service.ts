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
  conversations,
  conversationParticipants,
  messages,
  users,
} from '../../infrastructure/database/schema';
import { InternalUser, AuthService } from '../auth/auth.service';
import { PresenceService } from '../presence/presence.service';
import { MessagesService } from '../messages/messages.service';
import {
  Conversation,
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

  /**
   * List all conversations for the authenticated user
   */
  async listUserConversations(user: InternalUser): Promise<Conversation[]> {
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const userEmail = user.email.toLowerCase();
        const isBiz = user.role === 'business';

        // Fetch conversations where user is participant
        const convList = await db
          .select()
          .from(conversations)
          .where(isBiz ? eq(conversations.businessId, user.id) : eq(conversations.clientId, user.id))
          .orderBy(desc(conversations.lastMessageTimestamp));

        const result: Conversation[] = [];

        for (const c of convList) {
          // Check deleted view filters
          if (isBiz && c.deletedByBusinessAt) {
            if ((c.lastMessageTimestamp || 0) <= c.deletedByBusinessAt) {
              continue; // Hidden because history was cleared and no new messages arrived
            }
          }
          if (!isBiz && c.deletedForClientAt) {
            if ((c.lastMessageTimestamp || 0) <= c.deletedForClientAt) {
              continue;
            }
          }

          // Fetch other participant info
          const otherUserId = isBiz ? c.clientId : c.businessId;
          const otherUser = await this.authService.findUserById(otherUserId);
          const isOtherOnline = otherUser
            ? await this.presenceService.isOnline(otherUser.id)
            : false;

          const clientUser = isBiz ? otherUser : user;
          const bizUser = isBiz ? user : otherUser;
          const convMessages = this.messagesService?.getInMemoryMessagesForConversation(c.id) || [];

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
            status: c.status as 'active' | 'ended',
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
            messages: convMessages,
          });
        }

        return result;
      } catch (err) {
        this.logger.error('Failed to list conversations from DB:', err);
        throw new InternalServerErrorException('Database failure while querying conversations. Failed closed.');
      }
    }

    // In-memory fallback (only when DB is not configured/connected in local dev)
    const isBiz = user.role === 'business';
    const email = user.email.toLowerCase();

    return Promise.all(
      this.inMemoryConversations
        .filter((c) => {
          if (isBiz) {
            return (
              c.businessEmail.toLowerCase() === email ||
              c.businessId === user.id
            );
          }
          return (
            c.clientEmail.toLowerCase() === email ||
            c.clientId === user.id
          );
        })
        .map(async (c) => {
          const isOtherBiz = !isBiz;
          const otherEmail = isBiz ? c.clientEmail : c.businessEmail;
          const otherId = isBiz ? c.clientId : c.businessId;
          const otherName = isBiz ? c.clientName : c.businessName;
          const otherAvatar = isBiz ? c.clientAvatar : c.businessAvatar;

          const isOnline = await this.presenceService.isOnline(otherEmail || otherId);
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
   * Get single conversation by ID with membership check
   */
  async getConversation(conversationId: string, user: InternalUser): Promise<Conversation> {
    const list = await this.listUserConversations(user);
    const conv = list.find((c) => c.id === conversationId);
    if (!conv) {
      throw new NotFoundException('Conversation not found or access denied.');
    }
    return conv;
  }

  /**
   * Initiate a conversation (Client initiates with Business)
   */
  async initiateConversation(
    clientUser: InternalUser,
    dto: InitiateConversationDto
  ): Promise<Conversation> {
    const bizEmail = dto.businessEmail.trim().toLowerCase();
    const targetBusiness = await this.authService.findUserByEmail(bizEmail);

    if (!targetBusiness) {
      throw new BadRequestException(`Business user not found for email: ${dto.businessEmail}`);
    }

    const now = Date.now();
    const timeString = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();

        // Check if conversation already exists between this client and business
        const existing = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.clientId, clientUser.id),
              eq(conversations.businessId, targetBusiness.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const c = existing[0];
          // If ended, return it so client can choose to reopen
          return this.getConversation(c.id, clientUser);
        }

        const newConvId = crypto.randomUUID();

        // Transactional insert of conversation and participants
        await db.insert(conversations).values({
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

        await db.insert(conversationParticipants).values([
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
      } catch (err) {
        this.logger.error('Failed to initiate conversation in DB:', err);
        throw new InternalServerErrorException('Database failure while initiating conversation. Failed closed.');
      }
    }

    // In-memory fallback (only when DB is not configured/connected in local dev)
    // ENFORCE SINGLE SESSION PER CLIENT-BUSINESS PAIR:
    // Check if a conversation already exists between this client and business
    const existingMemory = this.inMemoryConversations.find(
      (c) =>
        (c.clientId === clientUser.id || c.clientEmail.toLowerCase() === clientUser.email.toLowerCase()) &&
        (c.businessId === targetBusiness.id || c.businessEmail.toLowerCase() === bizEmail)
    );

    if (existingMemory) {
      if (dto.workspaceName) {
        existingMemory.workspaceInfo = {
          ...existingMemory.workspaceInfo,
          name: dto.workspaceName,
        };
      }
      if (dto.initialMessage) {
        existingMemory.lastMessage = dto.initialMessage;
        existingMemory.lastMessageTime = timeString;
        existingMemory.lastMessageTimestamp = now;
        existingMemory.unreadByBusiness = (existingMemory.unreadByBusiness || 0) + 1;
      }
      return this.getConversation(existingMemory.id, clientUser);
    }

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
        name: dto.workspaceName || 'Orqspace',
        type: 'Orqspace',
        description: 'Direct communication channel between business and client.',
      },
      messages: [],
    };

    this.inMemoryConversations.unshift(newConv);
    return newConv;
  }

  /**
   * End a conversation session (closes connection and prevents future messages)
   */
  async endConversation(conversationId: string, user: InternalUser): Promise<Conversation> {
    const conv = await this.getConversation(conversationId, user);
    const now = Date.now();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(conversations)
          .set({
            status: 'ended',
            endedAt: now,
            endedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        return this.getConversation(conversationId, user);
      } catch (err) {
        this.logger.error('Failed to end conversation in DB:', err);
        throw new InternalServerErrorException('Database failure while ending conversation. Failed closed.');
      }
    }

    // In-memory fallback (only when DB is not configured/connected in local dev)
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

  /**
   * Reopen an ended conversation session
   */
  async reopenConversation(
    conversationId: string,
    user: InternalUser,
    dto: ReopenConversationDto
  ): Promise<Conversation> {
    const conv = await this.getConversation(conversationId, user);

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(conversations)
          .set({
            status: 'active',
            endedAt: null,
            endedBy: null,
            deletedByBusinessAt: null,
            deletedForClientAt: null,
            workspaceName: dto.workspaceName || conv.workspaceInfo.name,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        return this.getConversation(conversationId, user);
      } catch (err) {
        this.logger.error('Failed to reopen conversation in DB:', err);
        throw new InternalServerErrorException('Database failure while reopening conversation. Failed closed.');
      }
    }

    // In-memory fallback (only when DB is not configured/connected in local dev)
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

  /**
   * Clear conversation history on user's side (Delete chat view)
   */
  async deleteChatView(conversationId: string, user: InternalUser): Promise<Conversation> {
    const conv = await this.getConversation(conversationId, user);
    const now = Date.now();
    const isBiz = user.role === 'business';

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(conversations)
          .set(
            isBiz
              ? { deletedByBusinessAt: now, updatedAt: new Date() }
              : { deletedForClientAt: now, updatedAt: new Date() }
          )
          .where(eq(conversations.id, conversationId));

        return this.getConversation(conversationId, user);
      } catch (err) {
        this.logger.error('Failed to delete chat view in DB:', err);
        throw new InternalServerErrorException('Database failure while updating chat view in DB. Failed closed.');
      }
    }

    // In-memory fallback (only when DB is not configured/connected in local dev)
    const target = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (target) {
      if (isBiz) {
        target.deletedByBusiness = true;
        target.businessDeletedAt = now;
      } else {
        target.deletedForClient = true;
        target.clientDeletedAt = now;
      }
    }
    if (isBiz) {
      conv.deletedByBusiness = true;
      conv.businessDeletedAt = now;
    } else {
      conv.deletedForClient = true;
      conv.clientDeletedAt = now;
    }
    return conv;
  }

  /**
   * Mark messages in conversation as read
   */
  async markAsRead(conversationId: string, user: InternalUser): Promise<void> {
    const isBiz = user.role === 'business';

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        await db
          .update(conversations)
          .set(
            isBiz
              ? { unreadByBusiness: 0, updatedAt: new Date() }
              : { unreadByClient: 0, updatedAt: new Date() }
          )
          .where(eq(conversations.id, conversationId));

        // Also update message delivery status in database to 'read' for messages from the other user
        await db
          .update(messages)
          .set({ status: 'read' })
          .where(
            and(
              eq(messages.conversationId, conversationId),
              sql`${messages.senderId} != ${user.id}`
            )
          );
        return;
      } catch (err) {
        this.logger.error('Failed to mark conversation as read in DB:', err);
        throw new InternalServerErrorException('Database failure while marking conversation as read. Failed closed.');
      }
    }

    // In-memory fallback (only when DB is not configured/connected in local dev)
    const conv = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (conv) {
      if (isBiz) {
        conv.unreadByBusiness = 0;
      } else {
        conv.unreadByClient = 0;
      }
      conv.unreadCount = 0;
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
    timeString: string,
    sentByBusiness: boolean
  ) {
    const conv = this.inMemoryConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = lastMessage;
      conv.lastMessageTime = timeString;
      conv.lastMessageTimestamp = timestamp;
      if (sentByBusiness) {
        conv.unreadByClient = (conv.unreadByClient || 0) + 1;
      } else {
        conv.unreadByBusiness = (conv.unreadByBusiness || 0) + 1;
      }
    }
  }
}

