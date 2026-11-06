import { StorageService, SignedUploadPolicy } from '../../infrastructure/storage/storage.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
export declare class AttachmentsService {
    private readonly storageService;
    private readonly dbService;
    constructor(storageService: StorageService, dbService: DatabaseService);
    requestSignedUpload(userId: string, conversationId: string, fileName: string, mimeType: string, size: number): Promise<SignedUploadPolicy>;
}
