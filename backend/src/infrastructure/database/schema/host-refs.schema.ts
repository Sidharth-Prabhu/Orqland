// src/infrastructure/database/schema/host-refs.schema.ts (Sanitized Integration Boundary)
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

// Minimal boundary shape representing a platform user
export const orqUsers = pgTable('orq_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: varchar('display_name', { length: 100 }),
  email: varchar('email', { length: 255 }).unique(),
  avatar: varchar('avatar', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Minimal boundary shape representing any business workspace ("Orqspace")
export const orqspaces = pgTable('orqspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  orqspaceCode: varchar('orqspace_id', { length: 14 }).unique().notNull(), // e.g., public handle/ID
  name: varchar('name', { length: 150 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => orqUsers.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
