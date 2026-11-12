import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  chatMessages,
  chatConversations,
  chatMessageAttachments,
  orqUsers,
} from '../../infrastructure/database/schema';
import { InternalUser } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import {
  ChatMessage,
  ChatAttachment,
  LocationData,
  SendMessageDto,
  EditMessageDto,
  DeleteMessageDto,
  PaginatedMessagesResponseDto,
  ChatErrorCode,
  detectSensitiveContent,
} from '@orqland/contracts';
import { eq, and, desc, sql, lt, gt } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 10-minute edit window & 15-minute delete window per specification
const EDIT_WINDOW_MS = 10 * 60 * 1000;
const DELETE_WINDOW_MS = 15 * 60 * 1000;
// 48-hour attachment retention
const ATTACHMENT_RETENTION_MS = 48 * 60 * 60 * 1000;

function resolveDataDir(): string {
  let curr = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(curr, 'gryd.yaml'))) {
      return path.join(curr, 'backend', '.data');
    }
    curr = path.dirname(curr);
  }
  return path.resolve(process.cwd(), '.data');
}

const DATA_DIR = resolveDataDir();
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  // In-memory message store for development fallback
  private inMemoryMessages: ChatMessage[] = [];

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService
  ) {
    this.initDevMessages();
  }

  private initDevMessages() {
    // In test environment, always start with fresh test seed data
    if (process.env.NODE_ENV === 'test') {
      this.seedDevMessages();
      return;
    }

    try {
      if (fs.existsSync(MESSAGES_FILE)) {
        const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.inMemoryMessages = parsed;
          this.logger.log(`Loaded ${parsed.length} persisted messages from ${MESSAGES_FILE}`);
          return;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed reading persisted messages file: ${err}`);
    }

    // Default to empty message list for real users; no template mock messages
    this.inMemoryMessages = [];
    this.persistDevMessages();
  }

  private persistDevMessages() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(this.inMemoryMessages, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`Failed saving persisted messages to disk: ${err}`);
    }
  }

  private seedDevMessages() {
    const now = Date.now();
    this.inMemoryMessages = [
      {
        id: 'm0000000-0000-0000-0000-000000000001',
        conversationId: 'c0000000-0000-0000-0000-000000000001',
        senderId: 'u0000000-0000-0000-0000-000000000002',
        senderEmail: 'client1@orqland.test',
        senderName: 'Alice Client',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
        content: 'Hello! Inquiring about project kickoff and architecture alignment.',
        timestamp: '02:45 PM',
        date: 'Today',
        createdAt: now - 1800000,
        status: 'read',
      },
      {
        id: 'm0000000-0000-0000-0000-000000000002',
        conversationId: 'c0000000-0000-0000-0000-000000000001',
        senderId: 'a0000000-0000-0000-0000-000000000001',
        senderEmail: 'workspace.alpha@orqland.test',
        senderName: 'Alpha Strategic Workspace',
        senderAvatar: '',
        content: 'Welcome! Direct communication channel is active. Let us know your requirements.',
        timestamp: '02:51 PM',
        date: 'Today',
        createdAt: now - 1200000,
        status: 'read',
      },
      {
        id: 'm0000000-0000-0000-0000-000000000003',
        conversationId: 'cccccccc-cccc-cccc-cccc-cccccccc0001',
        senderId: '11111111-1111-1111-1111-111111111111',
        senderEmail: 'client1@orqland.test',
        senderName: 'Alice Client',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
        content: 'Hello! Inquiring about project kickoff and architecture alignment.',
        timestamp: '02:45 PM',
        date: 'Today',
        createdAt: now - 1800000,
        status: 'read',
      },
      {
        id: 'm0000000-0000-0000-0000-000000000004',
        conversationId: 'cccccccc-cccc-cccc-cccc-cccccccc0001',
        senderId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        senderEmail: 'workspace.alpha@orqland.test',
        senderName: 'Alpha Strategic Workspace',
        senderAvatar: '',
        content: 'Welcome! Direct communication channel is active. Let us know your requirements.',
        timestamp: '02:51 PM',
        date: 'Today',
        createdAt: now - 1200000,
        status: 'read',
      },
    ];
  }

  /**
   * DLP check: comprehensive sensitive content detection
   */
  private checkDlp(content: string) {
    const result = detectSensitiveContent(content);
    if (result.isBlocked) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: ChatErrorCode.SENSITIVE_CONTENT_BLOCKED,
        message: 'Message blocked by Data Loss Prevention (DLP) policy: sensitive credentials, financial details, or identity documents detected.',
      });
    }
  }

  /**
   * List paginated messages for a conversation
   */
  async getMessages(
    conversationId: string,
    user: InternalUser,
    limit: number = 50,
    beforeTimestamp?: number
  ): Promise<PaginatedMessagesResponseDto> {
    const conv = await this.conversationsService.getConversation(conversationId, user);
    const isClient = user.id === conv.clientId;
    const clearedBefore = isClient ? conv.clientDeletedAt : conv.businessDeletedAt;

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const conditions = [eq(chatMessages.conversationId, conversationId)];

        if (beforeTimestamp) {
          conditions.push(lt(chatMessages.createdAt, new Date(beforeTimestamp)));
        }

        if (clearedBefore) {
          conditions.push(gt(chatMessages.createdAt, new Date(clearedBefore)));
        }

        const rawMessages = await db
          .select({
            msg: chatMessages,
            sender: orqUsers,
          })
          .from(chatMessages)
          .leftJoin(orqUsers, eq(chatMessages.senderUserId, orqUsers.id))
          .where(and(...conditions))
          .orderBy(desc(chatMessages.createdAt))
          .limit(limit + 1);

        const hasMore = rawMessages.length > limit;
        const sliced = hasMore ? rawMessages.slice(0, limit) : rawMessages;
        sliced.reverse(); // Chronological order

        const messageIds = sliced.map((r) => r.msg.id);
        const attachmentMap = new Map<string, ChatAttachment[]>();

        if (messageIds.length > 0) {
          const rawAttachments = await db
            .select()
            .from(chatMessageAttachments)
            .where(sql`${chatMessageAttachments.messageId} IN ${messageIds}`);

          const now = Date.now();
          for (const att of rawAttachments) {
            const isExpired = att.isExpired || (att.expiresAt && att.expiresAt.getTime() <= now);
            const item: ChatAttachment = {
              id: att.id,
              type: att.attachmentType as any,
              name: att.fileName,
              url: isExpired ? '' : att.url,
              objectKey: att.storageKey,
              thumbnailUrl: att.thumbnailUrl || undefined,
              size: att.sizeBytes || undefined,
              mimeType: att.mimeType || undefined,
              uploadedAt: att.createdAt.getTime(),
              expiresAt: att.expiresAt.getTime(),
              isExpired,
              locationData: att.locationData as any,
            };

            const list = attachmentMap.get(att.messageId) || [];
            list.push(item);
            attachmentMap.set(att.messageId, list);
          }
        }

        const items: ChatMessage[] = sliced.map((r) => {
          const m = r.msg;
          const atts = attachmentMap.get(m.id) || [];
          const createdAtNum = m.createdAt.getTime();
          const timestampStr = new Date(createdAtNum).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return {
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderUserId,
            senderEmail: r.sender?.email || undefined,
            senderName: r.sender?.displayName || (m.senderSide === 'workspace' ? 'Workspace' : 'Client'),
            senderAvatar: r.sender?.avatar || '',
            content: m.deletedForEveryone ? 'This message was deleted' : m.content,
            timestamp: timestampStr,
            date: 'Today',
            createdAt: createdAtNum,
            isMe: m.senderUserId === user.id,
            status: m.status as any,
            attachment: atts[0],
            attachments: atts,
            deletedForEveryone: m.deletedForEveryone,
            isEdited: m.isEdited,
            editedAt: m.editedAt ? m.editedAt.getTime() : undefined,
          };
        });

        const nextCursor = hasMore && sliced.length > 0 ? sliced[0].msg.id : undefined;

        return {
          messages: items,
          nextCursor,
          hasMore,
        };
      } catch (err) {
        this.logger.error('Failed to query messages from DB:', err);
        throw new InternalServerErrorException('Database failure while querying messages. Failed closed.');
      }
    }

    // In-memory fallback
    let list = this.inMemoryMessages.filter((m) => m.conversationId === conversationId);
    if (clearedBefore) {
      list = list.filter((m) => m.createdAt > clearedBefore);
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

  /**
   * Send a new message with idempotency, rate limiting, and DLP check
   */
  async sendMessage(
    user: InternalUser,
    dto: SendMessageDto
  ): Promise<ChatMessage> {
    // 1. Distributed rate limit: 60 messages / minute per user
    const rateLimit = await this.redisService.checkRateLimit(user.id, 60, 60);
    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: ChatErrorCode.RATE_LIMIT_EXCEEDED,
          message: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds || 1}s before sending more messages.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 2. Access and active session check
    const conv = await this.conversationsService.getConversation(dto.conversationId, user);
    if (conv.status === 'ended') {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: ChatErrorCode.CONVERSATION_ENDED,
        message: 'This conversation session has ended. Reopen the session to send new messages.',
      });
    }

    // 3. Distributed idempotency check
    if (dto.idempotencyKey) {
      const cached = await this.redisService.getIdempotentMessage<ChatMessage>(dto.idempotencyKey);
      if (cached) {
        this.logger.log(`Distributed idempotency hit for key ${dto.idempotencyKey}; returning existing message.`);
        return cached;
      }
    }

    // 4. Server-Side DLP enforcement
    if (dto.content) {
      this.checkDlp(dto.content);
    }

    const now = Date.now();
    const nowDate = new Date(now);
    const timeString = nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = crypto.randomUUID();
    const isClient = user.id === conv.clientId;
    const senderSide = isClient ? 'client' : 'workspace';

    // Process attachments list
    const incomingAttachments: ChatAttachment[] = [];
    if (dto.attachments && dto.attachments.length > 0) {
      for (const att of dto.attachments) {
        if (att.url && att.url.startsWith('data:') && att.url.length > 2000) {
          throw new BadRequestException('Inline base64 file payloads are prohibited. Upload via storage signed URL.');
        }

        incomingAttachments.push({
          id: att.id || crypto.randomUUID(),
          type: att.type,
          name: att.name,
          url: att.url,
          objectKey: att.objectKey || `chat/${dto.conversationId}/${att.id || crypto.randomUUID()}-${att.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
          thumbnailUrl: att.thumbnailUrl,
          size: att.size,
          mimeType: att.mimeType,
          uploadedAt: now,
          expiresAt: now + ATTACHMENT_RETENTION_MS,
          locationData: att.locationData,
        });
      }
    } else if (dto.attachment) {
      if (dto.attachment.url && dto.attachment.url.startsWith('data:') && dto.attachment.url.length > 2000) {
        throw new BadRequestException('Inline base64 file payloads are prohibited. Upload via storage signed URL.');
      }

      incomingAttachments.push({
        id: dto.attachment.id || crypto.randomUUID(),
        type: dto.attachment.type,
        name: dto.attachment.name,
        url: dto.attachment.url,
        objectKey: dto.attachment.objectKey || `chat/${dto.conversationId}/${dto.attachment.id || crypto.randomUUID()}-${dto.attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        thumbnailUrl: dto.attachment.thumbnailUrl,
        size: dto.attachment.size,
        mimeType: dto.attachment.mimeType,
        uploadedAt: now,
        expiresAt: now + ATTACHMENT_RETENTION_MS,
        locationData: dto.attachment.locationData,
      });
    }

    const createdMessage: ChatMessage = {
      id: messageId,
      conversationId: dto.conversationId,
      senderId: user.id,
      senderEmail: user.email,
      senderName: user.name,
      senderAvatar: user.avatar,
      content: dto.content || '',
      timestamp: timeString,
      date: 'Today',
      createdAt: now,
      isMe: true,
      status: 'delivered',
      attachment: incomingAttachments[0],
      attachments: incomingAttachments,
      idempotencyKey: dto.idempotencyKey,
    };

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();

        // Database insert of chat message
        await db.insert(chatMessages).values({
          id: messageId,
          conversationId: dto.conversationId,
          senderUserId: user.id,
          senderSide,
          content: dto.content || '',
          messageType: incomingAttachments.length > 0 ? (incomingAttachments[0].type === 'location' ? 'location' : 'media') : 'text',
          idempotencyKey: dto.idempotencyKey || crypto.randomUUID(),
          status: 'delivered',
          createdAt: nowDate,
        });

        // Insert attachments if present
        if (incomingAttachments.length > 0) {
          for (const att of incomingAttachments) {
            await db.insert(chatMessageAttachments).values({
              id: att.id,
              messageId,
              attachmentType: att.type,
              fileName: att.name,
              mimeType: att.mimeType,
              sizeBytes: att.size,
              storageKey: att.objectKey || `chat/${dto.conversationId}/${att.id}-${att.name}`,
              url: att.url,
              thumbnailUrl: att.thumbnailUrl,
              locationData: att.locationData,
              expiresAt: new Date(att.expiresAt),
              createdAt: nowDate,
            });
          }
        }

        // Update conversation summary & unread counters
        await db
          .update(chatConversations)
          .set({
            lastMessagePreview: dto.content || 'Attachment sent',
            lastMessageAt: nowDate,
            updatedAt: nowDate,
            unreadByClient: isClient ? undefined : sql`${chatConversations.unreadByClient} + 1`,
            unreadByWorkspace: isClient ? sql`${chatConversations.unreadByWorkspace} + 1` : undefined,
          })
          .where(eq(chatConversations.id, dto.conversationId));
      } catch (err: any) {
        // If PostgreSQL unique constraint on idempotency fails, return existing message
        if (err?.code === '23505' && dto.idempotencyKey) {
          const db = this.dbService.getDb();
          const existing = await db
            .select()
            .from(chatMessages)
            .where(
              and(
                eq(chatMessages.conversationId, dto.conversationId),
                eq(chatMessages.idempotencyKey, dto.idempotencyKey)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            const em = existing[0];
            return {
              id: em.id,
              conversationId: em.conversationId,
              senderId: em.senderUserId,
              senderName: user.name,
              senderAvatar: user.avatar,
              content: em.content,
              timestamp: timeString,
              date: 'Today',
              createdAt: em.createdAt.getTime(),
              isMe: true,
              status: em.status as any,
              idempotencyKey: em.idempotencyKey,
            };
          }
        }

        this.logger.error('Failed to persist message in DB:', err);
        throw new InternalServerErrorException('Database failure while sending message. Failed closed.');
      }
    } else {
      // In-memory fallback
      this.inMemoryMessages.push(createdMessage);
      this.persistDevMessages();
      this.conversationsService.updateInMemoryConversationLastMessage(
        dto.conversationId,
        dto.content || 'Attachment sent',
        now,
        user.role
      );
    }

    // Save in Redis idempotency cache for 30s
    if (dto.idempotencyKey) {
      await this.redisService.setIdempotentMessage(dto.idempotencyKey, createdMessage, 30);
    }

    return createdMessage;
  }

  /**
   * Edit a message within the strict 10-minute window (sender only)
   */
  async editMessage(user: InternalUser, dto: EditMessageDto): Promise<ChatMessage> {
    const now = Date.now();
    this.checkDlp(dto.content);

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const existing = await db
          .select()
          .from(chatMessages)
          .where(and(eq(chatMessages.id, dto.messageId), eq(chatMessages.conversationId, dto.conversationId)))
          .limit(1);

        if (existing.length === 0) {
          throw new NotFoundException('Message not found.');
        }

        const msg = existing[0];
        if (msg.senderUserId !== user.id) {
          throw new ForbiddenException('You can only edit your own messages.');
        }

        if (now - msg.createdAt.getTime() > EDIT_WINDOW_MS) {
          throw new BadRequestException({
            statusCode: 400,
            errorCode: ChatErrorCode.MESSAGE_EDIT_EXPIRED,
            message: 'Messages can only be edited within 10 minutes of sending.',
          });
        }

        if (msg.deletedForEveryone) {
          throw new BadRequestException('Cannot edit a deleted message.');
        }

        const nowDate = new Date(now);
        await db
          .update(chatMessages)
          .set({
            content: dto.content,
            isEdited: true,
            editedAt: nowDate,
          })
          .where(eq(chatMessages.id, dto.messageId));

        return {
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderUserId,
          senderName: user.name,
          senderAvatar: user.avatar,
          content: dto.content,
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: 'Today',
          createdAt: msg.createdAt.getTime(),
          isMe: true,
          isEdited: true,
          editedAt: now,
        };
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof ForbiddenException || err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error('Failed to edit message in DB:', err);
        throw new InternalServerErrorException('Database failure while editing message. Failed closed.');
      }
    }

    // In-memory fallback
    const msg = this.inMemoryMessages.find((m) => m.id === dto.messageId);
    if (!msg) {
      throw new NotFoundException('Message not found.');
    }
    const isSender =
      msg.senderId === user.id ||
      (user.email && msg.senderEmail && user.email.toLowerCase() === msg.senderEmail.toLowerCase()) ||
      (user.name && msg.senderName && user.name.toLowerCase() === msg.senderName.toLowerCase());
    if (!isSender) {
      throw new ForbiddenException('You can only edit your own messages.');
    }
    if (now - msg.createdAt > EDIT_WINDOW_MS) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: ChatErrorCode.MESSAGE_EDIT_EXPIRED,
        message: 'Messages can only be edited within 10 minutes of sending.',
      });
    }

    msg.content = dto.content;
    msg.isEdited = true;
    msg.editedAt = now;
    this.persistDevMessages();
    return msg;
  }

  /**
   * Delete a message within the strict 15-minute window (sender only)
   */
  async deleteMessage(user: InternalUser, dto: DeleteMessageDto): Promise<ChatMessage> {
    const now = Date.now();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const existing = await db
          .select()
          .from(chatMessages)
          .where(and(eq(chatMessages.id, dto.messageId), eq(chatMessages.conversationId, dto.conversationId)))
          .limit(1);

        if (existing.length === 0) {
          throw new NotFoundException('Message not found.');
        }

        const msg = existing[0];
        if (msg.senderUserId !== user.id) {
          throw new ForbiddenException('You can only delete your own messages.');
        }

        if (now - msg.createdAt.getTime() > DELETE_WINDOW_MS) {
          throw new BadRequestException({
            statusCode: 400,
            errorCode: ChatErrorCode.MESSAGE_DELETE_EXPIRED,
            message: 'Messages can only be deleted within 15 minutes of sending.',
          });
        }

        const nowDate = new Date(now);
        await db
          .update(chatMessages)
          .set({
            content: 'This message was deleted',
            deletedForEveryone: true,
            deletedAt: nowDate,
          })
          .where(eq(chatMessages.id, dto.messageId));

        return {
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderUserId,
          senderName: user.name,
          senderAvatar: user.avatar,
          content: 'This message was deleted',
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: 'Today',
          createdAt: msg.createdAt.getTime(),
          isMe: msg.senderUserId === user.id,
          deletedForEveryone: true,
        };
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof ForbiddenException || err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error('Failed to delete message in DB:', err);
        throw new InternalServerErrorException('Database failure while deleting message. Failed closed.');
      }
    }

    // In-memory fallback
    const msg = this.inMemoryMessages.find((m) => m.id === dto.messageId);
    if (!msg) {
      throw new NotFoundException('Message not found.');
    }
    const isSender =
      msg.senderId === user.id ||
      (user.email && msg.senderEmail && user.email.toLowerCase() === msg.senderEmail.toLowerCase()) ||
      (user.name && msg.senderName && user.name.toLowerCase() === msg.senderName.toLowerCase());
    if (!isSender) {
      throw new ForbiddenException('You can only delete your own messages.');
    }
    if (now - msg.createdAt > DELETE_WINDOW_MS) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: ChatErrorCode.MESSAGE_DELETE_EXPIRED,
        message: 'Messages can only be deleted within 15 minutes of sending.',
      });
    }

    msg.content = 'This message was deleted';
    msg.deletedForEveryone = true;
    this.persistDevMessages();
    return msg;
  }

  /**
   * Helper for ConversationsService to get in-memory messages for a conversation
   */
  getInMemoryMessagesForConversation(conversationId: string, limit = 50): ChatMessage[] {
    const list = this.inMemoryMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt);
    return list.slice(Math.max(0, list.length - limit));
  }

  /**
   * Helper to append an in-memory message directly
   */
  addInMemoryMessage(msg: ChatMessage) {
    this.inMemoryMessages.push(msg);
    this.persistDevMessages();
  }

  /**
   * Helper to mark messages read in memory
   */
  markMessagesAsRead(conversationId: string, userId: string, userEmail?: string) {
    for (const m of this.inMemoryMessages) {
      if (m.conversationId === conversationId && m.senderId !== userId) {
        m.status = 'read';
      }
    }
  }

  /**
   * Purge expired attachments (48h retention)
   */
  async purgeExpiredAttachments(): Promise<{ purgedCount: number }> {
    let purgedCount = 0;
    const now = Date.now();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const expired = await db
          .select()
          .from(chatMessageAttachments)
          .where(and(lt(chatMessageAttachments.expiresAt, new Date(now)), eq(chatMessageAttachments.isExpired, false)));

        for (const item of expired) {
          await db
            .update(chatMessageAttachments)
            .set({ isExpired: true, url: '', expiredAt: new Date(now) })
            .where(eq(chatMessageAttachments.id, item.id));
          purgedCount++;
        }
      } catch (err) {
        this.logger.error('Failed to purge expired attachments in DB:', err);
      }
    }

    // Also purge in memory
    for (const m of this.inMemoryMessages) {
      if (m.attachments) {
        for (const a of m.attachments) {
          if (!a.isExpired && a.expiresAt <= now) {
            a.isExpired = true;
            a.url = '';
            purgedCount++;
          }
        }
      }
    }

    return { purgedCount };
  }
}
