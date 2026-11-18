import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from './redis.service';
import { INestApplicationContext, Logger } from '@nestjs/common';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  protected readonly ioLogger = new Logger(RedisIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly redisService: RedisService
  ) {
    super(app);
  }

  private resolveAdapterConstructor() {
    if (this.adapterConstructor) return this.adapterConstructor;
    const pub = this.redisService.getPubClient();
    const sub = this.redisService.getSubClient();
    if (pub && sub && this.redisService.isRedisConnected()) {
      this.adapterConstructor = createAdapter(pub, sub);
      this.ioLogger.log('Socket.IO Redis adapter enabled for multi-instance broadcast scaling.');
      return this.adapterConstructor;
    }
    this.ioLogger.warn('Socket.IO running in single-instance memory adapter mode (Redis not connected).');
    return null;
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    const adapter = this.resolveAdapterConstructor();
    if (adapter) {
      server.adapter(adapter);
    }

    return server;
  }
}
