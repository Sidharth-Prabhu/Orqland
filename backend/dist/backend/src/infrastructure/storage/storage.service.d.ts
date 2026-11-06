import { ConfigService } from '@nestjs/config';
export interface SignedUploadPolicy {
    uploadUrl: string;
    downloadUrl: string;
    objectKey: string;
    expiresInSeconds: number;
    attachmentId: string;
}
export declare class StorageService {
    private readonly configService;
    private readonly logger;
    private readonly signingSecret;
    private readonly publicBaseUrl;
    constructor(configService: ConfigService);
    validateFileMetadata(mimeType: string, size: number, fileName: string): void;
    generateSignedUploadUrl(conversationId: string, fileName: string, mimeType: string, size: number): SignedUploadPolicy;
    verifyUploadSignature(objectKey: string, mimeType: string, size: number, exp: number, sig: string): boolean;
}
