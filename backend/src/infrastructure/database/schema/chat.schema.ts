import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { orqUsers, orqspaces } from './host-refs.schema';

export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientUserId: uuid('client_user_id')
      .notNull()
      .references(() => orqUsers.id, { onDelete: 'cascade' }),
    orqspaceId: uuid('orqspace_id')
      .notNull()
      .references(() => orqspaces.id, { onDelete: 'cascade' }),
    // Lifecycle: 'active' | 'ended'
    status: varchar('status', { length: 20 }).default('active').notNull(),
    endedAt: timestamp('ended_at'),
    endedByUserId: uuid('ended_by_user_id').references(() => orqUsers.id, {
      onDelete: 'set null',
    }),
    // Per-side history clear watermark (hide messages older than this timestamp for that side)
    clientClearedBefore: timestamp('client_cleared_before'),
    workspaceClearedBefore: timestamp('workspace_cleared_before'),
    // Denormalized summary for fast inbox rendering
    lastMessagePreview: text('last_message_preview'),
    lastMessageAt: timestamp('last_message_at'),
    unreadByClient: integer('unread_by_client').default(0).notNull(),
    unreadByWorkspace: integer('unread_by_workspace').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // Enforces single thread per (client, workspace) pair (reopened instead of duplicated)
    uniqueIndex('uq_chat_conv_client_orqspace').on(table.clientUserId, table.orqspaceId),
    index('idx_chat_conv_orqspace_updated').on(table.orqspaceId, table.lastMessageAt),
    index('idx_chat_conv_client_updated').on(table.clientUserId, table.lastMessageAt),
  ]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => orqUsers.id, { onDelete: 'cascade' }),
    senderSide: varchar('sender_side', { length: 20 }).notNull(), // 'client' | 'workspace'
    content: text('content').default('').notNull(),
    messageType: varchar('message_type', { length: 20 }).default('text').notNull(), // 'text' | 'media' | 'location'
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    status: varchar('status', { length: 20 }).default('delivered').notNull(), // 'sent' | 'delivered' | 'read'
    isEdited: boolean('is_edited').default(false).notNull(),
    editedAt: timestamp('edited_at'),
    deletedForEveryone: boolean('deleted_for_everyone').default(false).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_chat_msg_idempotency').on(table.conversationId, table.idempotencyKey),
    index('idx_chat_msg_conv_created').on(table.conversationId, table.createdAt),
  ]
);

export const chatMessageAttachments = pgTable(
  'chat_message_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    attachmentType: varchar('attachment_type', { length: 20 }).notNull(), // 'image' | 'pdf' | 'location'
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    sizeBytes: integer('size_bytes'),
    // Simulated free-tier OR cloud storage object key & URL (never store base64 data URIs!)
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    locationData: jsonb('location_data').$type<{
      latitude: number;
      longitude: number;
      label?: string;
      mapUrl: string;
    }>(),
    // 48-hour retention policy enforced by @Cron purge worker
    expiresAt: timestamp('expires_at').notNull(),
    isExpired: boolean('is_expired').default(false).notNull(),
    expiredAt: timestamp('expired_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_chat_att_message').on(table.messageId),
    index('idx_chat_att_purge').on(table.isExpired, table.expiresAt),
  ]
);

export const chatMessageReceipts = pgTable(
  'chat_message_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => orqUsers.id, { onDelete: 'cascade' }),
    lastReadMessageId: uuid('last_read_message_id').references(() => chatMessages.id, {
      onDelete: 'set null',
    }),
    lastReadAt: timestamp('last_read_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('uq_chat_receipt_conv_user').on(table.conversationId, table.userId)]
);

export const chatPushTokens = pgTable(
  'chat_push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => orqUsers.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    platform: varchar('platform', { length: 20 }).default('web').notNull(), // 'web' | 'ios' | 'android'
    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_chat_push_user').on(table.userId)]
);
