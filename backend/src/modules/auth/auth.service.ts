import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { orqUsers, orqspaces } from '../../infrastructure/database/schema';
import { DecodedAuthToken } from './firebase-admin.service';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { BusinessDirectoryItem } from '@orqland/contracts';

export interface InternalUser {
  id: string; // internal ORQLAND UUID matching orq_users.id
  firebaseUid: string;
  email: string;
  name: string;
  handle: string;
  avatar: string;
  role: 'client' | 'business';
  wsid?: string;
  businessStatus?: 'Open' | 'Closed';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private inMemoryUsers = new Map<string, InternalUser>();
  private inMemoryWorkspaces: BusinessDirectoryItem[] = [];

  constructor(private readonly dbService: DatabaseService) {
    if (process.env.NODE_ENV === 'test') {
      this.seedTestFixtures();
    }
  }

  private seedTestFixtures() {
    const testUsers: InternalUser[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        firebaseUid: 'dev-client-1',
        email: 'client1@orqland.test',
        name: 'Alice Client',
        handle: '@client1',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop',
        role: 'client',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        firebaseUid: 'dev-client-2',
        email: 'client2@orqland.test',
        name: 'Bob Client',
        handle: '@client2',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop',
        role: 'client',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        firebaseUid: 'dev-owner-alpha',
        email: 'owner.alpha@orqland.test',
        name: 'Alpha Owner',
        handle: '@alphaowner',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop',
        role: 'business',
        wsid: 'WS#ALPHA#01',
        businessStatus: 'Open',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        firebaseUid: 'dev-owner-beta',
        email: 'owner.beta@orqland.test',
        name: 'Beta Owner',
        handle: '@betaowner',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop',
        role: 'business',
        wsid: 'WS#BETA#02',
        businessStatus: 'Open',
      },
    ];

    for (const u of testUsers) {
      this.inMemoryUsers.set(u.email.toLowerCase(), u);
      this.inMemoryUsers.set(u.id, u);
      this.inMemoryUsers.set(u.firebaseUid, u);
    }

    this.inMemoryWorkspaces = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ownerId: '33333333-3333-3333-3333-333333333333',
        name: 'Alpha Design & Engineering',
        email: 'owner.alpha@orqland.test',
        category: 'Workspace',
        description: 'Workspace WS#ALPHA#01',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop',
        wsid: 'WS#ALPHA#01',
        isOnline: true,
        status: 'Open',
        verified: true,
        services: ['General Consultation'],
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        ownerId: '44444444-4444-4444-4444-444444444444',
        name: 'Beta Cloud Architecture',
        email: 'owner.beta@orqland.test',
        category: 'Workspace',
        description: 'Workspace WS#BETA#02',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop',
        wsid: 'WS#BETA#02',
        isOnline: true,
        status: 'Open',
        verified: true,
        services: ['General Consultation'],
      },
    ];
  }

  async getBusinesses(): Promise<BusinessDirectoryItem[]> {
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const rows = await db
          .select({
            space: orqspaces,
            owner: orqUsers,
          })
          .from(orqspaces)
          .innerJoin(orqUsers, eq(orqspaces.ownerId, orqUsers.id));

        return rows.map(({ space, owner }) => ({
          id: space.id,
          ownerId: space.ownerId,
          name: space.name,
          email: owner.email || '',
          category: 'Workspace',
          description: `Workspace ${space.orqspaceCode}`,
          avatar: space.logoUrl || owner.avatar || '',
          wsid: space.orqspaceCode,
          isOnline: true,
          status: space.isActive ? 'Open' : 'Closed',
          verified: true,
          services: ['General Consultation'],
        }));
      } catch (err) {
        this.logger.error('Failed to query orqspaces directory from DB:', err);
      }
    }
    return this.inMemoryWorkspaces;
  }

  isBusinessEmail(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return false;

    const envBusinesses = (process.env.BUSINESS_EMAILS || process.env.BUSINESS_EMAIL || '')
      .toLowerCase()
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (envBusinesses.includes(clean)) return true;

    return this.inMemoryWorkspaces.some((b) => b.email.toLowerCase() === clean);
  }

  private async buildUserFromDb(
    u: { id: string; email: string | null; displayName: string | null; avatar: string | null },
    firebaseUid: string,
    fallbackName?: string,
    fallbackAvatar?: string
  ): Promise<InternalUser> {
    const db = this.dbService.getDb();
    const ownedSpaces = await db
      .select()
      .from(orqspaces)
      .where(eq(orqspaces.ownerId, u.id));

    const userEmail = (u.email || '').toLowerCase();
    const isBiz = ownedSpaces.length > 0 || this.isBusinessEmail(userEmail);

    return {
      id: u.id,
      firebaseUid,
      email: userEmail,
      name: u.displayName || fallbackName || userEmail.split('@')[0] || 'User',
      handle: `@${(userEmail || u.id).split('@')[0]}`,
      avatar: u.avatar || fallbackAvatar || '',
      role: isBiz ? 'business' : 'client',
      wsid: ownedSpaces[0]?.orqspaceCode,
      businessStatus: ownedSpaces[0] ? (ownedSpaces[0].isActive ? 'Open' : 'Closed') : 'Open',
    };
  }

  /**
   * Resolves Firebase token to internal ORQLAND user UUID.
   * Auto-provisions user in orq_users table on first login.
   */
  async resolveOrCreateUser(decoded: DecodedAuthToken): Promise<InternalUser> {
    const firebaseUid = decoded.uid;
    const email = (decoded.email || `${firebaseUid}@orqland.internal`).toLowerCase().trim();
    const name = decoded.name?.trim() || email.split('@')[0] || 'User';
    const avatar = decoded.picture || '';

    const role: 'client' | 'business' = this.isBusinessEmail(email) ? 'business' : 'client';

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();

        // 1. Check existing user in orq_users table
        const existingList = await db
          .select()
          .from(orqUsers)
          .where(eq(orqUsers.email, email))
          .limit(1);

        if (existingList.length > 0) {
          return this.buildUserFromDb(existingList[0], firebaseUid, name, avatar);
        }

        // 2. First-time registration -> Idempotent insert in case concurrent requests race
        const newUserId = crypto.randomUUID();
        await db
          .insert(orqUsers)
          .values({
            id: newUserId,
            displayName: name,
            email,
            avatar,
            isActive: true,
          })
          .onConflictDoNothing({ target: orqUsers.email });

        const insertedOrExisting = await db
          .select()
          .from(orqUsers)
          .where(eq(orqUsers.email, email))
          .limit(1);

        if (insertedOrExisting.length > 0) {
          return this.buildUserFromDb(insertedOrExisting[0], firebaseUid, name, avatar);
        }

        return {
          id: newUserId,
          firebaseUid,
          email,
          name,
          handle: `@${email.split('@')[0]}`,
          avatar,
          role,
          wsid: undefined,
          businessStatus: 'Open',
        };
      } catch (err) {
        this.logger.error('Database user resolution failed, using memory fallback:', err);
      }
    }

    // In-Memory Fallback for tests / no-DB mode
    let user =
      this.inMemoryUsers.get(firebaseUid) ||
      this.inMemoryUsers.get(email.toLowerCase()) ||
      this.inMemoryUsers.get(email);

    if (!user) {
      const newId = crypto.randomUUID();
      const ownedTestSpace = this.inMemoryWorkspaces.find((w) => w.email.toLowerCase() === email);
      user = {
        id: newId,
        firebaseUid,
        email,
        name,
        handle: `@${email.split('@')[0]}`,
        avatar,
        role: ownedTestSpace ? 'business' : role,
        wsid: ownedTestSpace?.wsid,
        businessStatus: 'Open',
      };
      this.inMemoryUsers.set(newId, user);
      this.inMemoryUsers.set(firebaseUid, user);
      this.inMemoryUsers.set(email.toLowerCase(), user);
      this.inMemoryUsers.set(email, user);
    } else {
      this.inMemoryUsers.set(firebaseUid, user);
    }

    return user;
  }

  async findUserById(id: string): Promise<InternalUser | null> {
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const rows = await db.select().from(orqUsers).where(eq(orqUsers.id, id)).limit(1);
        if (rows.length > 0) {
          return this.buildUserFromDb(rows[0], `user-${rows[0].id}`);
        }
      } catch (err) {
        this.logger.error('Database findUserById failed:', err);
      }
    }
    return this.inMemoryUsers.get(id) || null;
  }

  async findUserByEmail(email: string): Promise<InternalUser | null> {
    const clean = email.trim().toLowerCase();
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const rows = await db.select().from(orqUsers).where(eq(orqUsers.email, clean)).limit(1);
        if (rows.length > 0) {
          return this.buildUserFromDb(rows[0], `user-${rows[0].id}`);
        }
      } catch (err) {
        this.logger.error('Database findUserByEmail failed:', err);
      }
    }
    return this.inMemoryUsers.get(clean) || null;
  }

  async syncUserProfile(email: string, name?: string | null, avatar?: string | null): Promise<InternalUser> {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.findUserByEmail(cleanEmail);
    if (existing) {
      if (name) existing.name = name;
      if (avatar) existing.avatar = avatar;
      if (this.dbService.isDbConnected()) {
        try {
          const db = this.dbService.getDb();
          await db
            .update(orqUsers)
            .set({
              displayName: existing.name,
              avatar: existing.avatar,
            })
            .where(eq(orqUsers.id, existing.id));
        } catch (err) {
          this.logger.error('Failed to sync user profile in DB:', err);
        }
      }
      return existing;
    }
    return this.resolveOrCreateUser({
      uid: crypto.randomUUID(),
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      picture: avatar || '',
    });
  }
}
