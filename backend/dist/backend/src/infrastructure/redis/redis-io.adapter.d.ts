import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { RedisService } from './redis.service';
import { INestApplicationContext, Logger } from '@nestjs/common';
export declare class RedisIoAdapter extends IoAdapter {
    private readonly redisService;
    private adapterConstructor;
    protected readonly ioLogger: Logger;
    constructor(app: INestApplicationContext, redisService: RedisService);
    createIOServer(port: number, options?: ServerOptions): any;
}
