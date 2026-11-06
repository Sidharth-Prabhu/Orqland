import { DatabaseService } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
export declare class HealthController {
    private readonly dbService;
    private readonly redisService;
    constructor(dbService: DatabaseService, redisService: RedisService);
    getHealth(): {
        status: string;
        service: string;
        timestamp: string;
        uptimeSeconds: number;
        system: {
            platform: NodeJS.Platform;
            nodeVersion: string;
            cpuCount: number;
            freeMemoryMB: number;
            totalMemoryMB: number;
        };
        process: {
            rssMB: number;
            heapUsedMB: number;
            heapTotalMB: number;
        };
        database: {
            connected: boolean;
        };
        redis: {
            connected: boolean;
        };
    };
}
