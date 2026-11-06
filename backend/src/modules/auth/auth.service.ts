import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { users } from '../../infrastructure/database/schema';
import { DecodedAuthToken } from './firebase-admin.service';
import { eq, or } from 'drizzle-orm';
import * as crypto from 'crypto';

export interface InternalUser {
  id: string; // internal ORQLAND UUID
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
  private inMemoryUsers = new Map<string, InternalUser>(); // Fallback in-memory map

  constructor(private readonly dbService: DatabaseService) {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    const defaultBusiness: InternalUser = {
      id: 'a0000000-0000-0000-0000-000000000001',
      firebaseUid: 'biz-sidharth',
      email: 'mailtosidharth.me@gmail.com',
      name: "Sidharth Prabhu's Workspace",
      handle: 'sidharth_workspace',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocK77osqTQ76zfsDwgj5r5kQZiKsBHRgjI-1NqrM62sChRVilDG5dA=s96-c',
      role: 'business',
      wsid: 'WS#ENOJEXBC#',
      businessStatus: 'Open',
    };
    this.inMemoryUsers.set(defaultBusiness.email, defaultBusiness);
    this.inMemoryUsers.set(defaultBusiness.id, defaultBusiness);
    this.inMemoryUsers.set(defaultBusiness.firebaseUid, defaultBusiness);
  }

  /**
   * Resolves Firebase token to internal ORQLAND user UUID.
   * Auto-provisions user on first login if not found.
   */
  async resolveOrCreateUser(decoded: DecodedAuthToken): Promise<InternalUser> {
    const firebaseUid = decoded.uid;
    const email = (decoded.email || `${firebaseUid}@orqland.internal`).toLowerCase().trim();
    const name = decoded.name?.trim() || email.split('@')[0] || 'User';
    const avatar = decoded.picture || '';

    // Business identity rule: only mailtosidharth.me@gmail.com is business
    const role: 'client' | 'business' =
      email === 'mailtosidharth.me@gmail.com' ? 'business' : 'client';

    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();

        // 1. Check by firebaseUid or email
        const existingList = await db
          .select()
          .from(users)
          .where(or(eq(users.firebaseUid, firebaseUid), eq(users.email, email)))
          .limit(1);

        if (existingList.length > 0) {
          const u = existingList[0];
          // If firebaseUid wasn't linked yet, link it
          if (u.firebaseUid !== firebaseUid || u.avatarUrl !== avatar) {
            await db
              .update(users)
              .set({
                firebaseUid,
                avatarUrl: avatar || u.avatarUrl,
                name: name || u.name,
                updatedAt: new Date(),
              })
              .where(eq(users.id, u.id));
          }

          return {
            id: u.id,
            firebaseUid,
            email: u.email,
            name: u.name,
            handle: u.handle || `@${u.email.split('@')[0]}`,
            avatar: u.avatarUrl || '',
            role: (u.role as 'client' | 'business') || role,
            wsid: u.wsid || undefined,
            businessStatus: (u.businessStatus as 'Open' | 'Closed') || 'Open',
          };
        }

        // 2. First-time registration -> Insert new user
        const newUserId = crypto.randomUUID();
        const handle = `@${email.split('@')[0]}`;
        const wsid = role === 'business' ? 'WS#ENOJEXBC#' : undefined;

        await db.insert(users).values({
          id: newUserId,
          firebaseUid,
          email,
          name,
          handle,
          avatarUrl: avatar,
          role,
          wsid,
          businessStatus: 'Open',
          isOnline: true,
          lastSeenAt: Date.now(),
        });

        return {
          id: newUserId,
          firebaseUid,
          email,
          name,
          handle,
          avatar,
          role,
          wsid,
          businessStatus: 'Open',
        };
      } catch (err) {
        this.logger.error('Database user resolution failed, using memory fallback:', err);
      }
    }

    // In-Memory Fallback for development without PostgreSQL
    let user =
      this.inMemoryUsers.get(firebaseUid) || this.inMemoryUsers.get(email);
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
        wsid: role === 'business' ? 'WS#ENOJEXBC#' : undefined,
        businessStatus: 'Open',
      };
      this.inMemoryUsers.set(newId, user);
      this.inMemoryUsers.set(firebaseUid, user);
      this.inMemoryUsers.set(email, user);
    }
    return user;
  }

  async findUserById(id: string): Promise<InternalUser | null> {
    if (this.dbService.isDbConnected()) {
      try {
        const db = this.dbService.getDb();
        const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (rows.length > 0) {
          const u = rows[0];
          return {
            id: u.id,
            firebaseUid: u.firebaseUid,
            email: u.email,
            name: u.name,
            handle: u.handle || `@${u.email.split('@')[0]}`,
            avatar: u.avatarUrl || '',
            role: u.role as 'client' | 'business',
            wsid: u.wsid || undefined,
            businessStatus: (u.businessStatus as 'Open' | 'Closed') || 'Open',
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
        const rows = await db.select().from(users).where(eq(users.email, clean)).limit(1);
        if (rows.length > 0) {
          const u = rows[0];
          return {
            id: u.id,
            firebaseUid: u.firebaseUid,
            email: u.email,
            name: u.name,
            handle: u.handle || `@${u.email.split('@')[0]}`,
            avatar: u.avatarUrl || '',
            role: u.role as 'client' | 'business',
            wsid: u.wsid || undefined,
            businessStatus: (u.businessStatus as 'Open' | 'Closed') || 'Open',
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
            .update(users)
            .set({
              name: existing.name,
              avatarUrl: existing.avatar,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id));
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
