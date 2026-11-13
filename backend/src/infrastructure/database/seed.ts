import * as dotenv from 'dotenv';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const SEED_USERS = {
  client1: {
    id: '11111111-1111-1111-1111-111111111111',
    displayName: 'Alice Client',
    email: 'client1@orqland.test',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
    isActive: true,
  },
  client2: {
    id: '22222222-2222-2222-2222-222222222222',
    displayName: 'Bob Client',
    email: 'client2@orqland.test',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop',
    isActive: true,
  },
  ownerAlpha: {
    id: '33333333-3333-3333-3333-333333333333',
    displayName: 'Alpha Owner',
    email: 'owner.alpha@orqland.test',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop',
    isActive: true,
  },
  ownerBeta: {
    id: '44444444-4444-4444-4444-444444444444',
    displayName: 'Beta Owner',
    email: 'owner.beta@orqland.test',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop',
    isActive: true,
  },
};

export const SEED_WORKSPACES = {
  alpha: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orqspaceCode: 'WS#ALPHA#01',
    name: 'Alpha Design & Engineering',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop',
    ownerId: SEED_USERS.ownerAlpha.id,
    isActive: true,
  },
  beta: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    orqspaceCode: 'WS#BETA#02',
    name: 'Beta Cloud Architecture',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop',
    ownerId: SEED_USERS.ownerBeta.id,
    isActive: true,
  },
};

export const SEED_CONVERSATIONS = {
  client1Alpha: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccc0001',
    clientUserId: SEED_USERS.client1.id,
    orqspaceId: SEED_WORKSPACES.alpha.id,
    status: 'active',
    lastMessagePreview: 'Welcome to Alpha Design & Engineering!',
    lastMessageAt: new Date(),
    unreadByClient: 0,
    unreadByWorkspace: 0,
  },
  client1Beta: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccc0002',
    clientUserId: SEED_USERS.client1.id,
    orqspaceId: SEED_WORKSPACES.beta.id,
    status: 'active',
    lastMessagePreview: 'Cloud architecture consultation thread.',
    lastMessageAt: new Date(Date.now() - 3600000),
    unreadByClient: 0,
    unreadByWorkspace: 0,
  },
  client2Alpha: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccc0003',
    clientUserId: SEED_USERS.client2.id,
    orqspaceId: SEED_WORKSPACES.alpha.id,
    status: 'active',
    lastMessagePreview: 'Inquiry regarding design system scaling.',
    lastMessageAt: new Date(Date.now() - 7200000),
    unreadByClient: 0,
    unreadByWorkspace: 0,
  },
};

export async function seedDatabase() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/orqland_db';

  console.log(`[Seed] Connecting to database at ${databaseUrl}...`);
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    // 1. Seed Platform Users
    for (const u of Object.values(SEED_USERS)) {
      await db.insert(schema.orqUsers).values(u).onConflictDoNothing();
    }

    // 2. Seed Workspaces
    for (const ws of Object.values(SEED_WORKSPACES)) {
      await db.insert(schema.orqspaces).values(ws).onConflictDoNothing();
    }

    // 3. Seed Conversations
    for (const conv of Object.values(SEED_CONVERSATIONS)) {
      await db.insert(schema.chatConversations).values(conv).onConflictDoNothing();
    }

    console.log('[Seed] Database seeded successfully with multi-workspace fixtures!');
  } catch (err) {
    console.error('[Seed] Database seeding failed:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase();
}
