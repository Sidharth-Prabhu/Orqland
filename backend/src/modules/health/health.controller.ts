import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import * as os from 'os';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService
  ) {}

  @Get()
  getHealth() {
    const mem = process.memoryUsage();
    return {
      status: 'healthy',
      service: 'orqland-chat-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      },
      process: {
        rssMB: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
      },
      database: {
        connected: this.dbService.isDbConnected(),
      },
      redis: {
        connected: this.redisService.isRedisConnected(),
      },
    };
  }
}
