import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface AttachmentPolicyResult {
  storageKey: string;
  uploadMode: 'simulated' | 'cloud';
  uploadUrl: string;
  url: string;
  expiresAt: Date;
}

export abstract class ChatStorageProvider {
  abstract createUploadPolicy(params: {
    conversationId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<AttachmentPolicyResult>;

  abstract deleteObject(storageKey: string): Promise<void>;
}

@Injectable()
export class SimulatedChatStorageProvider extends ChatStorageProvider {
  private readonly allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  private readonly dangerousExts = [
    'exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'msi', 'zip', 'tar', 'gz', 'html', 'svg',
  ];

  async createUploadPolicy(params: {
    conversationId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<AttachmentPolicyResult> {
    const { conversationId, fileName, mimeType, sizeBytes } = params;

    // 1. Validate file size (<= 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (sizeBytes > MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 5MB attachment limit.');
    }

    // 2. Validate MIME type
    if (!this.allowedMimes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Security Policy Violation: File type ${mimeType} is not permitted. Only JPG, PNG, WebP, and PDF are allowed.`
      );
    }

    // 3. Validate file extension
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (this.dangerousExts.includes(ext)) {
      throw new BadRequestException(
        `Security Policy Violation: .${ext} files are strictly prohibited.`
      );
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const attachmentId = crypto.randomUUID();
    const storageKey = `chat/${conversationId}/${attachmentId}-${sanitizedFileName}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour retention

    return {
      storageKey,
      uploadMode: 'simulated',
      uploadUrl: `/api/v1/chat/attachments/simulate-upload/${attachmentId}`,
      url: `https://storage.simulated.local/${storageKey}`,
      expiresAt,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    // In simulation mode, this is a clean no-op as objects are simulated
    // When swapping with GCS/S3 provider, it calls the cloud SDK delete
  }
}
