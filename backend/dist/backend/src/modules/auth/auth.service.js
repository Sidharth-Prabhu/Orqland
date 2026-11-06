"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../infrastructure/database/database.service");
const schema_1 = require("../../infrastructure/database/schema");
const drizzle_orm_1 = require("drizzle-orm");
const crypto = require("crypto");
let AuthService = AuthService_1 = class AuthService {
    dbService;
    logger = new common_1.Logger(AuthService_1.name);
    inMemoryUsers = new Map();
    constructor(dbService) {
        this.dbService = dbService;
        this.seedDefaultUsers();
    }
    seedDefaultUsers() {
        const defaultBusiness = {
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
    async resolveOrCreateUser(decoded) {
        const firebaseUid = decoded.uid;
        const email = (decoded.email || `${firebaseUid}@orqland.internal`).toLowerCase().trim();
        const name = decoded.name?.trim() || email.split('@')[0] || 'User';
        const avatar = decoded.picture || '';
        const role = email === 'mailtosidharth.me@gmail.com' ? 'business' : 'client';
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const existingList = await db
                    .select()
                    .from(schema_1.users)
                    .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.users.firebaseUid, firebaseUid), (0, drizzle_orm_1.eq)(schema_1.users.email, email)))
                    .limit(1);
                if (existingList.length > 0) {
                    const u = existingList[0];
                    if (u.firebaseUid !== firebaseUid || u.avatarUrl !== avatar) {
                        await db
                            .update(schema_1.users)
                            .set({
                            firebaseUid,
                            avatarUrl: avatar || u.avatarUrl,
                            name: name || u.name,
                            updatedAt: new Date(),
                        })
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, u.id));
                    }
                    return {
                        id: u.id,
                        firebaseUid,
                        email: u.email,
                        name: u.name,
                        handle: u.handle || `@${u.email.split('@')[0]}`,
                        avatar: u.avatarUrl || '',
                        role: u.role || role,
                        wsid: u.wsid || undefined,
                        businessStatus: u.businessStatus || 'Open',
                    };
                }
                const newUserId = crypto.randomUUID();
                const handle = `@${email.split('@')[0]}`;
                const wsid = role === 'business' ? 'WS#ENOJEXBC#' : undefined;
                await db.insert(schema_1.users).values({
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
            }
            catch (err) {
                this.logger.error('Database user resolution failed, using memory fallback:', err);
            }
        }
        let user = this.inMemoryUsers.get(firebaseUid) || this.inMemoryUsers.get(email);
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
    async findUserById(id) {
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const rows = await db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
                if (rows.length > 0) {
                    const u = rows[0];
                    return {
                        id: u.id,
                        firebaseUid: u.firebaseUid,
                        email: u.email,
                        name: u.name,
                        handle: u.handle || `@${u.email.split('@')[0]}`,
                        avatar: u.avatarUrl || '',
                        role: u.role,
                        wsid: u.wsid || undefined,
                        businessStatus: u.businessStatus || 'Open',
                    };
                }
            }
            catch (err) {
                this.logger.error('Database findUserById failed:', err);
            }
        }
        return this.inMemoryUsers.get(id) || null;
    }
    async findUserByEmail(email) {
        const clean = email.trim().toLowerCase();
        if (this.dbService.isDbConnected()) {
            try {
                const db = this.dbService.getDb();
                const rows = await db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, clean)).limit(1);
                if (rows.length > 0) {
                    const u = rows[0];
                    return {
                        id: u.id,
                        firebaseUid: u.firebaseUid,
                        email: u.email,
                        name: u.name,
                        handle: u.handle || `@${u.email.split('@')[0]}`,
                        avatar: u.avatarUrl || '',
                        role: u.role,
                        wsid: u.wsid || undefined,
                        businessStatus: u.businessStatus || 'Open',
                    };
                }
            }
            catch (err) {
                this.logger.error('Database findUserByEmail failed:', err);
            }
        }
        return this.inMemoryUsers.get(clean) || null;
    }
    async syncUserProfile(email, name, avatar) {
        const cleanEmail = email.trim().toLowerCase();
        const existing = await this.findUserByEmail(cleanEmail);
        if (existing) {
            if (name)
                existing.name = name;
            if (avatar)
                existing.avatar = avatar;
            if (this.dbService.isDbConnected()) {
                try {
                    const db = this.dbService.getDb();
                    await db
                        .update(schema_1.users)
                        .set({
                        name: existing.name,
                        avatarUrl: existing.avatar,
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.users.id, existing.id));
                }
                catch (err) {
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AuthService);
//# sourceMappingURL=auth.service.js.map