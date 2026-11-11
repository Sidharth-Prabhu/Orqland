import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  bigint,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ----------------------------------------------------
// Users Table (Mapped from Firebase UID to internal UUID)
// ----------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    handle: varchar('handle', { length: 100 }),
    avatarUrl: text('avatar_url'),
    role: varchar('role', { length: 20 }).notNull().default('client'), // 'client' | 'business'
    location: varchar('location', { length: 255 }),
    wsid: varchar('wsid', { length: 100 }),
    businessStatus: varchar('business_status', { length: 20 }).default('Open'), // 'Open' | 'Closed'
    isOnline: boolean('is_online').default(false),
    lastSeenAt: bigint('last_seen_at', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_firebase_uid_idx').on(table.firebaseUid),
    uniqueIndex('users_email_idx').on(table.email),
  ]
);

// ----------------------------------------------------
// Conversations Table
// ----------------------------------------------------
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'ended'
    endedAt: bigint('ended_at', { mode: 'number' }),
    endedBy: uuid('ended_by').references(() => users.id),
    deletedByBusinessAt: bigint('deleted_by_business_at', { mode: 'number' }),
    deletedForClientAt: bigint('deleted_for_client_at', { mode: 'number' }),
    workspaceName: varchar('workspace_name', { length: 255 }).default('Orqspace'),
    workspaceType: varchar('workspace_type', { length: 100 }).default('Orqspace Info'),
    workspaceDescription: text('workspace_description'),
    bookingServiceName: varchar('booking_service_name', { length: 255 }),
    bookingStatus: varchar('booking_status', { length: 50 }),
    lastMessageText: text('last_message_text').default(''),
    lastMessageTime: varchar('last_message_time', { length: 50 }).default(''),
    lastMessageTimestamp: bigint('last_message_timestamp', { mode: 'number' }).default(0),
    unreadByClient: integer('unread_by_client').default(0).notNull(),
    unreadByBusiness: integer('unread_by_business').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('conv_client_idx').on(table.clientId),
    index('conv_business_idx').on(table.businessId),
    index('conv_status_idx').on(table.status),
    index('conv_last_msg_idx').on(table.lastMessageTimestamp),
  ]
);

// ----------------------------------------------------
// Conversation Participants (Membership & Read Cursors)
// ----------------------------------------------------
export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // 'client' | 'business'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    lastReadMessageId: uuid('last_read_message_id'),
    lastReadAt: bigint('last_read_at', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('conv_participant_unique_idx').on(table.conversationId, table.userId),
    index('conv_participant_user_idx').on(table.userId),
  ]
);

// ----------------------------------------------------
// Messages Table (Idempotent, Ordered by sequence & time)
// ----------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').default(''),
    type: varchar('type', { length: 20 }).default('text'), // 'text' | 'media' | 'location' | 'system'
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    status: varchar('status', { length: 20 }).default('delivered'), // 'sending' | 'sent' | 'delivered' | 'read'
    sequenceNumber: bigint('sequence_number', { mode: 'number' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    timestampDisplay: varchar('timestamp_display', { length: 50 }).notNull(),
    dateDisplay: varchar('date_display', { length: 50 }).default('Today'),
    isEdited: boolean('is_edited').default(false).notNull(),
    editedAt: bigint('edited_at', { mode: 'number' }),
    deletedByClient: boolean('deleted_by_client').default(false).notNull(),
    deletedByBusiness: boolean('deleted_by_business').default(false).notNull(),
    deletedForEveryone: boolean('deleted_for_everyone').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('messages_idempotency_idx').on(table.conversationId, table.idempotencyKey),
    index('messages_conv_created_idx').on(table.conversationId, table.createdAt),
    index('messages_sender_idx').on(table.senderId),
  ]
);

// ----------------------------------------------------
// Message Attachments (Signed URLs, No Raw File Bytes)
// ----------------------------------------------------
export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(), // 'image' | 'pdf' | 'location'
    name: varchar('name', { length: 255 }).notNull(),
    objectKey: text('object_key').notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    mimeType: varchar('mime_type', { length: 100 }),
    size: integer('size'),
    uploadStatus: varchar('upload_status', { length: 20 }).default('completed'), // 'pending' | 'completed' | 'failed'
    locationData: jsonb('location_data'),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(), // uploadedAt + 48 hours
    isExpired: boolean('is_expired').default(false).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('attachments_message_idx').on(table.messageId),
    index('attachments_expires_idx').on(table.expiresAt),
  ]
);

// ----------------------------------------------------
// Message Receipts / Read State
// ----------------------------------------------------
export const messageReceipts = pgTable(
  'message_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('delivered'), // 'delivered' | 'read'
    deliveredAt: bigint('delivered_at', { mode: 'number' }),
    readAt: bigint('read_at', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('receipt_msg_user_idx').on(table.messageId, table.userId),
  ]
);

// ----------------------------------------------------
// User Push Notification Tokens (FCM Tokens)
// ----------------------------------------------------
export const userPushTokens = pgTable(
  'user_push_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    fcmToken: text('fcm_token').notNull(),
    deviceType: varchar('device_type', { length: 50 }).default('web'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('user_push_tokens_token_idx').on(table.fcmToken),
    index('user_push_tokens_user_idx').on(table.userId),
  ]
);

// ----------------------------------------------------
// Outbox Events (Transactional Post-Commit Broadcast)
// ----------------------------------------------------
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending' | 'published' | 'failed'
    retryCount: integer('retry_count').default(0).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    publishedAt: bigint('published_at', { mode: 'number' }),
  },
  (table) => [
    index('outbox_status_idx').on(table.status),
  ]
);

// ----------------------------------------------------
// Relations
// ----------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  participants: many(conversationParticipants),
  sentMessages: many(messages),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  client: one(users, { fields: [conversations.clientId], references: [users.id] }),
  business: one(users, { fields: [conversations.businessId], references: [users.id] }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  attachments: many(messageAttachments),
  receipts: many(messageReceipts),
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, { fields: [messageAttachments.messageId], references: [messages.id] }),
}));
