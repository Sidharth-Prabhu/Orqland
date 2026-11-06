import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from './redis.service';
import { INestApplicationContext, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  protected readonly ioLogger = new Logger(RedisIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly redisService: RedisService
  ) {
    super(app);
    const pub = this.redisService.getPubClient();
    const sub = this.redisService.getSubClient();

    if (pub && sub && this.redisService.isRedisConnected()) {
      this.adapterConstructor = createAdapter(pub, sub);
      this.ioLogger.log('Socket.IO Redis adapter enabled for multi-instance broadcast scaling.');
    } else {
      this.ioLogger.warn('Socket.IO running in single-instance memory adapter mode (Redis not connected).');
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
