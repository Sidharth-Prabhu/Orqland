import { PresenceService } from './presence.service';
import { InternalUser } from '../auth/auth.service';
export declare class PresenceController {
    private readonly presenceService;
    constructor(presenceService: PresenceService);
    heartbeat(user: InternalUser): Promise<{
        success: boolean;
        timestamp: number;
    }>;
}
