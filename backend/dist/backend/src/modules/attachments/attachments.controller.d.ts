import { AttachmentsService } from './attachments.service';
import { InternalUser } from '../auth/auth.service';
import { Request, Response } from 'express';
export declare class AttachmentsController {
    private readonly attachmentsService;
    constructor(attachmentsService: AttachmentsService);
    requestUploadUrl(user: InternalUser, body: {
        conversationId: string;
        fileName: string;
        mimeType: string;
        size: number;
    }): Promise<{
        uploadUrl: string;
        downloadUrl: string;
        objectKey: string;
        expiresInSeconds: number;
        attachmentId: string;
        success: boolean;
    }>;
    handleDirectUpload(id: string, req: Request, res: Response): Promise<void>;
    handleDirectDownload(id: string, res: Response): Promise<Response<any, Record<string, any>>>;
}
