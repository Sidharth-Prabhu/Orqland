import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export declare class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private pool;
    private db;
    private isConnected;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private connect;
    private initializeSchema;
    getDb(): NodePgDatabase<typeof schema>;
    isDbConnected(): boolean;
}
