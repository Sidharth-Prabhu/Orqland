import { DatabaseService } from '../../infrastructure/database/database.service';
import { DecodedAuthToken } from './firebase-admin.service';
export interface InternalUser {
    id: string;
    firebaseUid: string;
    email: string;
    name: string;
    handle: string;
    avatar: string;
    role: 'client' | 'business';
    wsid?: string;
    businessStatus?: 'Open' | 'Closed';
}
export declare class AuthService {
    private readonly dbService;
    private readonly logger;
    private inMemoryUsers;
    constructor(dbService: DatabaseService);
    private seedDefaultUsers;
    resolveOrCreateUser(decoded: DecodedAuthToken): Promise<InternalUser>;
    findUserById(id: string): Promise<InternalUser | null>;
    findUserByEmail(email: string): Promise<InternalUser | null>;
    syncUserProfile(email: string, name?: string | null, avatar?: string | null): Promise<InternalUser>;
}
