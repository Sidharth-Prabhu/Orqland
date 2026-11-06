"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = require("./schema");
const crypto = require("crypto");
async function seedDatabase() {
    const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/orqland_db';
    console.log(`[Seed] Connecting to database at ${databaseUrl}...`);
    const pool = new pg_1.Pool({ connectionString: databaseUrl });
    const db = (0, node_postgres_1.drizzle)(pool, { schema });
    try {
        const businessUserId = 'a0000000-0000-0000-0000-000000000001';
        const clientUserId = 'u0000000-0000-0000-0000-000000000002';
        const conversationId = 'c0000000-0000-0000-0000-000000000001';
        await db
            .insert(schema.users)
            .values({
            id: businessUserId,
            firebaseUid: 'firebase-biz-sidharth',
            email: 'mailtosidharth.me@gmail.com',
            name: "Sidharth Prabhu's Workspace",
            handle: '@mailtosidharth.me',
            avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocK77osqTQ76zfsDwgj5r5kQZiKsBHRgjI-1NqrM62sChRVilDG5dA=s96-c',
            role: 'business',
            businessStatus: 'Open',
            wsid: 'WS#ENOJEXBC#',
            isOnline: true,
        })
            .onConflictDoNothing();
        await db
            .insert(schema.users)
            .values({
            id: clientUserId,
            firebaseUid: 'firebase-client-sidharth',
            email: 'ycssidharth@gmail.com',
            name: 'Sidharth Prabhu',
            handle: '@ycssidharth',
            avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocLc1nCqvrP5EtodEm0Zq5cKvkrYEH-I0jaoX8bFrpvmR4FyQeUh=s96-c',
            role: 'client',
            isOnline: true,
        })
            .onConflictDoNothing();
        await db
            .insert(schema.conversations)
            .values({
            id: conversationId,
            clientId: clientUserId,
            businessId: businessUserId,
            status: 'active',
            workspaceName: 'Technical Architecture',
            workspaceType: 'Orqspace',
            workspaceDescription: 'Direct communication channel between business and client.',
            lastMessageText: 'Technical Architecture discussion is active.',
            lastMessageTime: '02:51 PM',
            lastMessageTimestamp: Date.now() - 3600000,
            unreadByClient: 0,
            unreadByBusiness: 0,
        })
            .onConflictDoNothing();
        await db
            .insert(schema.conversationParticipants)
            .values([
            {
                id: crypto.randomUUID(),
                conversationId,
                userId: clientUserId,
                role: 'client',
            },
            {
                id: crypto.randomUUID(),
                conversationId,
                userId: businessUserId,
                role: 'business',
            },
        ])
            .onConflictDoNothing();
        console.log('[Seed] Database seeded successfully with default users & conversations!');
    }
    catch (err) {
        console.error('[Seed] Database seeding failed:', err);
    }
    finally {
        await pool.end();
    }
}
if (require.main === module) {
    seedDatabase();
}
//# sourceMappingURL=seed.js.map