import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

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

  private async initializeSchema() {
    if (!this.db || !this.isConnected) return;
    try {
      // Create tables if they do not exist
      await this.db.execute(sql`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firebase_uid VARCHAR(128) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          handle VARCHAR(100),
          avatar_url TEXT,
          role VARCHAR(20) NOT NULL DEFAULT 'client',
          location VARCHAR(255),
          wsid VARCHAR(100),
          business_status VARCHAR(20) DEFAULT 'Open',
          is_online BOOLEAN DEFAULT false,
          last_seen_at BIGINT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          business_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          ended_at BIGINT,
          ended_by UUID REFERENCES users(id),
          deleted_by_business_at BIGINT,
          deleted_for_client_at BIGINT,
          workspace_name VARCHAR(255) DEFAULT 'Orqspace',
          workspace_type VARCHAR(100) DEFAULT 'Orqspace Info',
          workspace_description TEXT,
          booking_service_name VARCHAR(255),
          booking_status VARCHAR(50),
          last_message_text TEXT DEFAULT '',
          last_message_time VARCHAR(50) DEFAULT '',
          last_message_timestamp BIGINT DEFAULT 0,
          unread_by_client INTEGER NOT NULL DEFAULT 0,
          unread_by_business INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS conversation_participants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          left_at TIMESTAMP WITH TIME ZONE,
          last_read_message_id UUID,
          last_read_at BIGINT,
          UNIQUE (conversation_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT DEFAULT '',
          type VARCHAR(20) DEFAULT 'text',
          idempotency_key VARCHAR(128),
          status VARCHAR(20) DEFAULT 'delivered',
          sequence_number BIGSERIAL,
          created_at BIGINT NOT NULL,
          timestamp_display VARCHAR(50) NOT NULL,
          date_display VARCHAR(50) DEFAULT 'Today',
          is_edited BOOLEAN NOT NULL DEFAULT false,
          edited_at BIGINT,
          deleted_by_client BOOLEAN NOT NULL DEFAULT false,
          deleted_by_business BOOLEAN NOT NULL DEFAULT false,
          deleted_for_everyone BOOLEAN NOT NULL DEFAULT false,
          UNIQUE (conversation_id, idempotency_key)
        );

        CREATE TABLE IF NOT EXISTS message_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          name VARCHAR(255) NOT NULL,
          object_key TEXT NOT NULL,
          url TEXT NOT NULL,
          thumbnail_url TEXT,
          mime_type VARCHAR(100),
          size INTEGER,
          upload_status VARCHAR(20) DEFAULT 'completed',
          location_data JSONB,
          expires_at BIGINT NOT NULL,
          is_expired BOOLEAN NOT NULL DEFAULT false,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS message_receipts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'delivered',
          delivered_at BIGINT,
          read_at BIGINT,
          UNIQUE (message_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS outbox_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL,
          published_at BIGINT
        );
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
