import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface DecodedAuthToken {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: any;
}
export declare class FirebaseAdminService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private firebaseApp;
    private isConfigured;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    verifyIdToken(token: string): Promise<DecodedAuthToken>;
    private decodeDevToken;
}
