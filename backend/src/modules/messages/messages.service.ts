import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  messages,
  conversations,
  messageAttachments,
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
} from '@orqland/contracts';
import { eq, and, desc, sql, lt, gt } from 'drizzle-orm';
import * as crypto from 'crypto';

// 10-minute edit window & 15-minute delete window per specification
const EDIT_WINDOW_MS = 10 * 60 * 1000;
const DELETE_WINDOW_MS = 15 * 60 * 1000;
// 48-hour attachment retention
const ATTACHMENT_RETENTION_MS = 48 * 60 * 60 * 1000;

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
    this.seedDevMessages();
  }

  private seedDevMessages() {
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

  /**
   * DLP check: simple regex for sensitive content (Credit Card Numbers, SSNs)
   */
  private checkDlp(content: string) {
    const ccRegex = /\b(?:\d{4}[ -]?){3}(?:\d{4}|\d{1,3})\b/;
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;

    if (ccRegex.test(content) || ssnRegex.test(content)) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: ChatErrorCode.SENSITIVE_CONTENT_BLOCKED,
        message: 'Message blocked by Data Loss Prevention (DLP) policy: sensitive credentials or numbers detected.',
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
    const isBiz = user.role === 'business';
    const deletedAt = isBiz ? conv.businessDeletedAt : conv.clientDeletedAt;

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const conditions = [eq(messages.conversationId, conversationId)];

        if (beforeTimestamp) {
          conditions.push(lt(messages.createdAt, beforeTimestamp));
        }
        if (deletedAt) {
          conditions.push(gt(messages.createdAt, deletedAt));
        }

        const msgRecords = await db
          .select()
          .from(messages)
          .where(and(...conditions))
          .orderBy(desc(messages.createdAt))
          .limit(limit + 1);

        const hasMore = msgRecords.length > limit;
        const sliced = hasMore ? msgRecords.slice(0, limit) : msgRecords;

        // Fetch attachments for these messages
        const msgIds = sliced.map((m) => m.id);
        const allAttachments =
          msgIds.length > 0
            ? await db
                .select()
                .from(messageAttachments)
                .where(sql`${messageAttachments.messageId} IN ${msgIds}`)
            : [];

        const attachmentMap = new Map<string, ChatAttachment[]>();
        for (const att of allAttachments) {
          const list = attachmentMap.get(att.messageId) || [];
          const now = Date.now();
          const loc = att.locationData as LocationData | null | undefined;
          list.push({
            id: att.id,
            type: att.type as 'image' | 'pdf' | 'location',
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

        const items: ChatMessage[] = sliced.reverse().map((m) => {
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
            status: (m.status as any) || 'delivered',
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
      } catch (err) {
        this.logger.error('Failed to query messages from DB:', err);
      }
    }

    // In-memory fallback
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

  /**
   * Send a new message with idempotency and session lifecycle check
   */
  async sendMessage(
    user: InternalUser,
    dto: SendMessageDto
  ): Promise<ChatMessage> {
    // Distributed rate limit: 60 messages / minute per user
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

    const conv = await this.conversationsService.getConversation(dto.conversationId, user);

    // Enforce active session
    if (conv.status === 'ended') {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: ChatErrorCode.CONVERSATION_ENDED,
        message: 'This conversation session has ended. Reopen the session to send new messages.',
      });
    }

    // Enforce distributed idempotency key deduplication
    if (dto.idempotencyKey) {
      const cached = await this.redisService.getIdempotentMessage<ChatMessage>(dto.idempotencyKey);
      if (cached) {
        this.logger.log(`Distributed idempotency hit for key ${dto.idempotencyKey}; returning existing message.`);
        return cached;
      }
    }

    // Check DLP
    if (dto.content) {
      this.checkDlp(dto.content);
    }

    const now = Date.now();
    const timeString = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = crypto.randomUUID();

    // Process attachments list
    const incomingAttachments: ChatAttachment[] = [];
    if (dto.attachments && dto.attachments.length > 0) {
      for (const att of dto.attachments) {
        // Enforce no inline raw data URLs / bloated base64 strings in persistent database
        if (att.url && att.url.startsWith('data:') && att.url.length > 2000) {
          throw new BadRequestException('Inline base64 file payloads are prohibited. Upload via storage signed URL.');
        }

        incomingAttachments.push({
          id: att.id || crypto.randomUUID(),
          type: att.type,
          name: att.name,
          url: att.url,
          objectKey: att.objectKey || `attachments/${dto.conversationId}/${att.id || crypto.randomUUID()}/${att.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
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
        objectKey: dto.attachment.objectKey || `attachments/${dto.conversationId}/${dto.attachment.id || crypto.randomUUID()}/${dto.attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        thumbnailUrl: dto.attachment.thumbnailUrl,
        size: dto.attachment.size,
        mimeType: dto.attachment.mimeType,
        uploadedAt: now,
        expiresAt: now + ATTACHMENT_RETENTION_MS,
        locationData: dto.attachment.locationData,
      });
    }

    const createdMsg: ChatMessage = {
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

        // Transactional insert: message + attachments + update conversation summary
        await db.transaction(async (tx) => {
          await tx.insert(messages).values({
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
            await tx.insert(messageAttachments).values({
              id: att.id,
              messageId: messageId,
              type: att.type,
              name: att.name,
              objectKey: att.objectKey || att.id,
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

          // Update conversation last message and unread count
          await tx
            .update(conversations)
            .set({
              lastMessageText: createdMsg.content,
              lastMessageTime: timeString,
              lastMessageTimestamp: now,
              unreadByClient: isBiz ? sql`${conversations.unreadByClient} + 1` : conversations.unreadByClient,
              unreadByBusiness: !isBiz ? sql`${conversations.unreadByBusiness} + 1` : conversations.unreadByBusiness,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, dto.conversationId));
        });

        if (dto.idempotencyKey) {
          await this.redisService.setIdempotentMessage(dto.idempotencyKey, createdMsg, 86400);
        }

        return createdMsg;
      } catch (err) {
        this.logger.error('Failed to insert message into DB:', err);
      }
    }

    // In-memory fallback
    this.inMemoryMessages.push(createdMsg);
    if (dto.idempotencyKey) {
      await this.redisService.setIdempotentMessage(dto.idempotencyKey, createdMsg, 86400);
    }

    // Update the conversation's last message, timestamp, and unread counters in in-memory mode
    this.conversationsService.updateInMemoryConversationLastMessage(
      dto.conversationId,
      createdMsg.content,
      now,
      timeString,
      user.role === 'business'
    );

    return createdMsg;
  }

  /**
   * Edit a message within the 10-minute window
   */
  async editMessage(user: InternalUser, dto: EditMessageDto): Promise<ChatMessage> {
    const now = Date.now();
    this.checkDlp(dto.content);

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const existing = await db
          .select()
          .from(messages)
          .where(and(eq(messages.id, dto.messageId), eq(messages.conversationId, dto.conversationId)))
          .limit(1);

        if (existing.length === 0) {
          throw new NotFoundException('Message not found.');
        }

        const msg = existing[0];
        if (msg.senderId !== user.id) {
          throw new ForbiddenException('You can only edit your own messages.');
        }

        if (now - msg.createdAt > EDIT_WINDOW_MS) {
          throw new BadRequestException({
            statusCode: 400,
            errorCode: ChatErrorCode.MESSAGE_EDIT_EXPIRED,
            message: 'Messages can only be edited within 10 minutes of sending.',
          });
        }

        await db
          .update(messages)
          .set({
            content: dto.content,
            isEdited: true,
            editedAt: now,
          })
          .where(eq(messages.id, dto.messageId));

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
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof ForbiddenException || err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error('Failed to edit message in DB:', err);
      }
    }

    // In-memory fallback
    const msg = this.inMemoryMessages.find((m) => m.id === dto.messageId);
    if (!msg) {
      throw new NotFoundException('Message not found.');
    }
    if (msg.senderId !== user.id) {
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
    return msg;
  }

  /**
   * Delete a message within the 15-minute window
   */
  async deleteMessage(user: InternalUser, dto: DeleteMessageDto): Promise<ChatMessage> {
    const now = Date.now();

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const existing = await db
          .select()
          .from(messages)
          .where(and(eq(messages.id, dto.messageId), eq(messages.conversationId, dto.conversationId)))
          .limit(1);

        if (existing.length === 0) {
          throw new NotFoundException('Message not found.');
        }

        const msg = existing[0];
        if (msg.senderId !== user.id && user.role !== 'business') {
          throw new ForbiddenException('You can only delete your own messages.');
        }

        if (now - msg.createdAt > DELETE_WINDOW_MS) {
          throw new BadRequestException({
            statusCode: 400,
            errorCode: ChatErrorCode.MESSAGE_DELETE_EXPIRED,
            message: 'Messages can only be deleted within 15 minutes of sending.',
          });
        }

        await db
          .update(messages)
          .set({
            content: 'This message was deleted',
            deletedForEveryone: true,
          })
          .where(eq(messages.id, dto.messageId));

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
      } catch (err) {
        if (err instanceof BadRequestException || err instanceof ForbiddenException || err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error('Failed to delete message in DB:', err);
      }
    }

    // In-memory fallback
    const msg = this.inMemoryMessages.find((m) => m.id === dto.messageId);
    if (!msg) {
      throw new NotFoundException('Message not found.');
    }
    if (msg.senderId !== user.id && user.role !== 'business') {
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
   * Mark all unread messages in a conversation as read by the reader
   */
  markMessagesAsRead(conversationId: string, readerUserId: string, readerEmail?: string) {
    const normReaderEmail = readerEmail?.toLowerCase().trim();
    for (const msg of this.inMemoryMessages) {
      if (msg.conversationId === conversationId) {
        const isFromOther =
          msg.senderId !== readerUserId &&
          (!normReaderEmail || msg.senderEmail?.toLowerCase().trim() !== normReaderEmail);
        if (isFromOther) {
          msg.status = 'read';
        }
      }
    }
  }
}
