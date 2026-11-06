"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageAttachmentsRelations = exports.messagesRelations = exports.conversationsRelations = exports.usersRelations = exports.outboxEvents = exports.messageReceipts = exports.messageAttachments = exports.messages = exports.conversationParticipants = exports.conversations = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    firebaseUid: (0, pg_core_1.varchar)('firebase_uid', { length: 128 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    handle: (0, pg_core_1.varchar)('handle', { length: 100 }),
    avatarUrl: (0, pg_core_1.text)('avatar_url'),
    role: (0, pg_core_1.varchar)('role', { length: 20 }).notNull().default('client'),
    location: (0, pg_core_1.varchar)('location', { length: 255 }),
    wsid: (0, pg_core_1.varchar)('wsid', { length: 100 }),
    businessStatus: (0, pg_core_1.varchar)('business_status', { length: 20 }).default('Open'),
    isOnline: (0, pg_core_1.boolean)('is_online').default(false),
    lastSeenAt: (0, pg_core_1.bigint)('last_seen_at', { mode: 'number' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('users_firebase_uid_idx').on(table.firebaseUid),
    (0, pg_core_1.uniqueIndex)('users_email_idx').on(table.email),
]);
exports.conversations = (0, pg_core_1.pgTable)('conversations', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    clientId: (0, pg_core_1.uuid)('client_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    businessId: (0, pg_core_1.uuid)('business_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('active'),
    endedAt: (0, pg_core_1.bigint)('ended_at', { mode: 'number' }),
    endedBy: (0, pg_core_1.uuid)('ended_by').references(() => exports.users.id),
    deletedByBusinessAt: (0, pg_core_1.bigint)('deleted_by_business_at', { mode: 'number' }),
    deletedForClientAt: (0, pg_core_1.bigint)('deleted_for_client_at', { mode: 'number' }),
    workspaceName: (0, pg_core_1.varchar)('workspace_name', { length: 255 }).default('Orqspace'),
    workspaceType: (0, pg_core_1.varchar)('workspace_type', { length: 100 }).default('Orqspace Info'),
    workspaceDescription: (0, pg_core_1.text)('workspace_description'),
    bookingServiceName: (0, pg_core_1.varchar)('booking_service_name', { length: 255 }),
    bookingStatus: (0, pg_core_1.varchar)('booking_status', { length: 50 }),
    lastMessageText: (0, pg_core_1.text)('last_message_text').default(''),
    lastMessageTime: (0, pg_core_1.varchar)('last_message_time', { length: 50 }).default(''),
    lastMessageTimestamp: (0, pg_core_1.bigint)('last_message_timestamp', { mode: 'number' }).default(0),
    unreadByClient: (0, pg_core_1.integer)('unread_by_client').default(0).notNull(),
    unreadByBusiness: (0, pg_core_1.integer)('unread_by_business').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('conv_client_idx').on(table.clientId),
    (0, pg_core_1.index)('conv_business_idx').on(table.businessId),
    (0, pg_core_1.index)('conv_status_idx').on(table.status),
    (0, pg_core_1.index)('conv_last_msg_idx').on(table.lastMessageTimestamp),
]);
exports.conversationParticipants = (0, pg_core_1.pgTable)('conversation_participants', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    conversationId: (0, pg_core_1.uuid)('conversation_id').notNull().references(() => exports.conversations.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    role: (0, pg_core_1.varchar)('role', { length: 20 }).notNull(),
    joinedAt: (0, pg_core_1.timestamp)('joined_at', { withTimezone: true }).defaultNow().notNull(),
    leftAt: (0, pg_core_1.timestamp)('left_at', { withTimezone: true }),
    lastReadMessageId: (0, pg_core_1.uuid)('last_read_message_id'),
    lastReadAt: (0, pg_core_1.bigint)('last_read_at', { mode: 'number' }),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('conv_participant_unique_idx').on(table.conversationId, table.userId),
    (0, pg_core_1.index)('conv_participant_user_idx').on(table.userId),
]);
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    conversationId: (0, pg_core_1.uuid)('conversation_id').notNull().references(() => exports.conversations.id, { onDelete: 'cascade' }),
    senderId: (0, pg_core_1.uuid)('sender_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    content: (0, pg_core_1.text)('content').default(''),
    type: (0, pg_core_1.varchar)('type', { length: 20 }).default('text'),
    idempotencyKey: (0, pg_core_1.varchar)('idempotency_key', { length: 128 }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('delivered'),
    sequenceNumber: (0, pg_core_1.bigint)('sequence_number', { mode: 'number' }),
    createdAt: (0, pg_core_1.bigint)('created_at', { mode: 'number' }).notNull(),
    timestampDisplay: (0, pg_core_1.varchar)('timestamp_display', { length: 50 }).notNull(),
    dateDisplay: (0, pg_core_1.varchar)('date_display', { length: 50 }).default('Today'),
    isEdited: (0, pg_core_1.boolean)('is_edited').default(false).notNull(),
    editedAt: (0, pg_core_1.bigint)('edited_at', { mode: 'number' }),
    deletedByClient: (0, pg_core_1.boolean)('deleted_by_client').default(false).notNull(),
    deletedByBusiness: (0, pg_core_1.boolean)('deleted_by_business').default(false).notNull(),
    deletedForEveryone: (0, pg_core_1.boolean)('deleted_for_everyone').default(false).notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('messages_idempotency_idx').on(table.conversationId, table.idempotencyKey),
    (0, pg_core_1.index)('messages_conv_created_idx').on(table.conversationId, table.createdAt),
    (0, pg_core_1.index)('messages_sender_idx').on(table.senderId),
]);
exports.messageAttachments = (0, pg_core_1.pgTable)('message_attachments', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    messageId: (0, pg_core_1.uuid)('message_id').notNull().references(() => exports.messages.id, { onDelete: 'cascade' }),
    type: (0, pg_core_1.varchar)('type', { length: 20 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    objectKey: (0, pg_core_1.text)('object_key').notNull(),
    url: (0, pg_core_1.text)('url').notNull(),
    thumbnailUrl: (0, pg_core_1.text)('thumbnail_url'),
    mimeType: (0, pg_core_1.varchar)('mime_type', { length: 100 }),
    size: (0, pg_core_1.integer)('size'),
    uploadStatus: (0, pg_core_1.varchar)('upload_status', { length: 20 }).default('completed'),
    locationData: (0, pg_core_1.jsonb)('location_data'),
    expiresAt: (0, pg_core_1.bigint)('expires_at', { mode: 'number' }).notNull(),
    isExpired: (0, pg_core_1.boolean)('is_expired').default(false).notNull(),
    createdAt: (0, pg_core_1.bigint)('created_at', { mode: 'number' }).notNull(),
}, (table) => [
    (0, pg_core_1.index)('attachments_message_idx').on(table.messageId),
    (0, pg_core_1.index)('attachments_expires_idx').on(table.expiresAt),
]);
exports.messageReceipts = (0, pg_core_1.pgTable)('message_receipts', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    messageId: (0, pg_core_1.uuid)('message_id').notNull().references(() => exports.messages.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('delivered'),
    deliveredAt: (0, pg_core_1.bigint)('delivered_at', { mode: 'number' }),
    readAt: (0, pg_core_1.bigint)('read_at', { mode: 'number' }),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('receipt_msg_user_idx').on(table.messageId, table.userId),
]);
exports.outboxEvents = (0, pg_core_1.pgTable)('outbox_events', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    eventType: (0, pg_core_1.varchar)('event_type', { length: 100 }).notNull(),
    payload: (0, pg_core_1.jsonb)('payload').notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('pending').notNull(),
    retryCount: (0, pg_core_1.integer)('retry_count').default(0).notNull(),
    createdAt: (0, pg_core_1.bigint)('created_at', { mode: 'number' }).notNull(),
    publishedAt: (0, pg_core_1.bigint)('published_at', { mode: 'number' }),
}, (table) => [
    (0, pg_core_1.index)('outbox_status_idx').on(table.status),
]);
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    participants: many(exports.conversationParticipants),
    sentMessages: many(exports.messages),
}));
exports.conversationsRelations = (0, drizzle_orm_1.relations)(exports.conversations, ({ one, many }) => ({
    client: one(exports.users, { fields: [exports.conversations.clientId], references: [exports.users.id] }),
    business: one(exports.users, { fields: [exports.conversations.businessId], references: [exports.users.id] }),
    participants: many(exports.conversationParticipants),
    messages: many(exports.messages),
}));
exports.messagesRelations = (0, drizzle_orm_1.relations)(exports.messages, ({ one, many }) => ({
    conversation: one(exports.conversations, { fields: [exports.messages.conversationId], references: [exports.conversations.id] }),
    sender: one(exports.users, { fields: [exports.messages.senderId], references: [exports.users.id] }),
    attachments: many(exports.messageAttachments),
    receipts: many(exports.messageReceipts),
}));
exports.messageAttachmentsRelations = (0, drizzle_orm_1.relations)(exports.messageAttachments, ({ one }) => ({
    message: one(exports.messages, { fields: [exports.messageAttachments.messageId], references: [exports.messages.id] }),
}));
//# sourceMappingURL=schema.js.map