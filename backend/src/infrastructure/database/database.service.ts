import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private db: NodePgDatabase<typeof schema> | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL connection pool closed.');
    }
  }

  private async connect() {
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL') ||
      'postgres://postgres:postgres@localhost:5432/orqland_db';

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 4000,
      });

      this.db = drizzle(this.pool, { schema });

      // Test connection
      const client = await this.pool.connect();
      client.release();

      this.isConnected = true;
      this.logger.log('Connected to PostgreSQL database successfully.');

      // Run runtime schema initialization
      await this.initializeSchema();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PostgreSQL not reachable at ${databaseUrl} (${msg}). Running in mock/memory-resilient development mode.`
      );
      this.isConnected = false;
    }
  }

  private resolveMigrationsFolder(): string | null {
    const candidates = [
      path.resolve(__dirname, '../../../drizzle'),
      path.resolve(__dirname, '../../../../drizzle'),
      path.resolve(process.cwd(), 'drizzle'),
      path.resolve(process.cwd(), 'backend/drizzle'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'meta', '_journal.json'))) {
        return candidate;
      }
    }
    return null;
  }

  private async initializeSchema() {
    if (!this.db || !this.isConnected) return;
    try {
      const migrationsFolder = this.resolveMigrationsFolder();
      if (migrationsFolder) {
        await migrate(this.db, { migrationsFolder });
        this.logger.log(`Drizzle migrations applied from ${migrationsFolder}.`);
        return;
      }

      // Fallback DDL matching schema/host-refs.schema.ts and schema/chat.schema.ts
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS orq_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          display_name VARCHAR(100),
          email VARCHAR(255) UNIQUE,
          avatar VARCHAR(500),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS orqspaces (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          orqspace_id VARCHAR(14) UNIQUE NOT NULL,
          name VARCHAR(150) NOT NULL,
          logo_url VARCHAR(500),
          owner_id UUID NOT NULL REFERENCES orq_users(id) ON DELETE CASCADE,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS chat_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_user_id UUID NOT NULL REFERENCES orq_users(id) ON DELETE CASCADE,
          orqspace_id UUID NOT NULL REFERENCES orqspaces(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          ended_at TIMESTAMP,
          ended_by_user_id UUID REFERENCES orq_users(id) ON DELETE SET NULL,
          client_cleared_before TIMESTAMP,
          workspace_cleared_before TIMESTAMP,
          last_message_preview TEXT,
          last_message_at TIMESTAMP,
          unread_by_client INTEGER NOT NULL DEFAULT 0,
          unread_by_workspace INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conv_client_orqspace ON chat_conversations(client_user_id, orqspace_id);
        CREATE INDEX IF NOT EXISTS idx_chat_conv_orqspace_updated ON chat_conversations(orqspace_id, last_message_at);
        CREATE INDEX IF NOT EXISTS idx_chat_conv_client_updated ON chat_conversations(client_user_id, last_message_at);

        CREATE TABLE IF NOT EXISTS chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
          sender_user_id UUID NOT NULL REFERENCES orq_users(id) ON DELETE CASCADE,
          sender_side VARCHAR(20) NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          message_type VARCHAR(20) NOT NULL DEFAULT 'text',
          idempotency_key VARCHAR(128) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'delivered',
          is_edited BOOLEAN NOT NULL DEFAULT false,
          edited_at TIMESTAMP,
          deleted_for_everyone BOOLEAN NOT NULL DEFAULT false,
          deleted_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_msg_idempotency ON chat_messages(conversation_id, idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_created ON chat_messages(conversation_id, created_at);

        CREATE TABLE IF NOT EXISTS chat_message_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
          attachment_type VARCHAR(20) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100),
          size_bytes INTEGER,
          storage_key TEXT NOT NULL,
          url TEXT NOT NULL,
          thumbnail_url TEXT,
          location_data JSONB,
          expires_at TIMESTAMP NOT NULL,
          is_expired BOOLEAN NOT NULL DEFAULT false,
          expired_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_chat_att_message ON chat_message_attachments(message_id);
        CREATE INDEX IF NOT EXISTS idx_chat_att_purge ON chat_message_attachments(is_expired, expires_at);

        CREATE TABLE IF NOT EXISTS chat_message_receipts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES orq_users(id) ON DELETE CASCADE,
          last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
          last_read_at TIMESTAMP NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_receipt_conv_user ON chat_message_receipts(conversation_id, user_id);

        CREATE TABLE IF NOT EXISTS chat_push_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES orq_users(id) ON DELETE CASCADE,
          token TEXT UNIQUE NOT NULL,
          platform VARCHAR(20) NOT NULL DEFAULT 'web',
          last_used_at TIMESTAMP NOT NULL DEFAULT now(),
          created_at TIMESTAMP NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_chat_push_user ON chat_push_tokens(user_id);
      `);
      this.logger.log('PostgreSQL schema verified and up-to-date.');
    } catch (err) {
      this.logger.error('Failed to initialize PostgreSQL schema:', err);
    }
  }

  getDb(): NodePgDatabase<typeof schema> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database is not connected');
    }
    return this.db;
  }

  isDbConnected(): boolean {
    return this.isConnected;
  }
}
