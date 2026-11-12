import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { orqUsers, orqspaces } from '../../infrastructure/database/schema';
import { DecodedAuthToken } from './firebase-admin.service';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { INITIAL_BUSINESSES, BusinessDirectoryItem } from '@orqland/contracts';

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
  private businessDirectory: BusinessDirectoryItem[] = [...INITIAL_BUSINESSES];

  constructor(private readonly dbService: DatabaseService) {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    // Seed neutral test users
    const defaultUsers: InternalUser[] = [
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
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        firebaseUid: 'biz-mailtosidharth.me@gmail.com',
        email: 'mailtosidharth.me@gmail.com',
        name: 'Sidharth Prabhu',
        handle: '@sidharth',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocK77osqTQ76zfsDwgj5r5kQZiKsBHRgjI-1NqrM62sChRVilDG5dA=s96-c',
        role: 'business',
        wsid: 'WS#ALPHA#01',
        businessStatus: 'Open',
      },
    ];

    for (const u of defaultUsers) {
      this.inMemoryUsers.set(u.email.toLowerCase(), u);
      this.inMemoryUsers.set(u.id, u);
      this.inMemoryUsers.set(u.firebaseUid, u);
    }

    // Seed all directory businesses as in-memory users
    for (const biz of this.businessDirectory) {
      const bizUser: InternalUser = {
        id: biz.id,
        firebaseUid: `biz-${biz.id}`,
        email: biz.email.toLowerCase(),
        name: biz.name,
        handle: `@${biz.email.split('@')[0]}`,
        avatar: biz.avatar,
        role: 'business',
        wsid: biz.wsid,
        businessStatus: biz.status,
      };
      this.inMemoryUsers.set(bizUser.email.toLowerCase(), bizUser);
      this.inMemoryUsers.set(bizUser.id, bizUser);
      this.inMemoryUsers.set(bizUser.firebaseUid, bizUser);
    }
  }

  getBusinesses(): BusinessDirectoryItem[] {
    return this.businessDirectory;
  }

  isBusinessEmail(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    const envBusinesses = (process.env.BUSINESS_EMAILS || process.env.BUSINESS_EMAIL || '')
      .toLowerCase()
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (envBusinesses.includes(clean)) return true;
    if (clean === 'mailtosidharth.me@gmail.com') return true;

    return this.businessDirectory.some((b) => b.email.toLowerCase() === clean);
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

    // Dynamic Business identity rule
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
          const u = existingList[0];
          return {
            id: u.id,
            firebaseUid,
            email: u.email || email,
            name: u.displayName || name,
            handle: `@${(u.email || email).split('@')[0]}`,
            avatar: u.avatar || avatar,
            role,
            wsid: role === 'business' ? 'WS#ALPHA#01' : undefined,
            businessStatus: 'Open',
          };
        }

        // 2. First-time registration -> Insert new user into orq_users
        const newUserId = crypto.randomUUID();
        await db.insert(orqUsers).values({
          id: newUserId,
          displayName: name,
          email,
          avatar,
          isActive: true,
        });

        return {
          id: newUserId,
          firebaseUid,
          email,
          name,
          handle: `@${email.split('@')[0]}`,
          avatar,
          role,
          wsid: role === 'business' ? 'WS#ALPHA#01' : undefined,
          businessStatus: 'Open',
        };
      } catch (err) {
        this.logger.error('Database user resolution failed, using memory fallback:', err);
      }
    }

    // In-Memory Fallback for development without PostgreSQL
    let user =
      this.inMemoryUsers.get(firebaseUid) ||
      this.inMemoryUsers.get(email.toLowerCase()) ||
      this.inMemoryUsers.get(email);

    if (!user) {
      const newId = crypto.randomUUID();
      user = {
        id: newId,
        firebaseUid,
        email,
        name,
        handle: `@${email.split('@')[0]}`,
        avatar,
        role,
        wsid: role === 'business' ? 'WS#ALPHA#01' : undefined,
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
          const u = rows[0];
          const isBiz = this.isBusinessEmail(u.email || '');
          return {
            id: u.id,
            firebaseUid: `user-${u.id}`,
            email: u.email || '',
            name: u.displayName || '',
            handle: `@${(u.email || '').split('@')[0]}`,
            avatar: u.avatar || '',
            role: isBiz ? 'business' : 'client',
            wsid: isBiz ? 'WS#ALPHA#01' : undefined,
            businessStatus: 'Open',
          };
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
          const u = rows[0];
          const isBiz = this.isBusinessEmail(u.email || '');
          return {
            id: u.id,
            firebaseUid: `user-${u.id}`,
            email: u.email || clean,
            name: u.displayName || '',
            handle: `@${(u.email || clean).split('@')[0]}`,
            avatar: u.avatar || '',
            role: isBiz ? 'business' : 'client',
            wsid: isBiz ? 'WS#ALPHA#01' : undefined,
            businessStatus: 'Open',
          };
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
