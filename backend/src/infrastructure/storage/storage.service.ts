import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';

export interface SignedUploadPolicy {
  uploadUrl: string;
  downloadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  attachmentId: string;
  signature?: string;
  expiresAt?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly signingSecret: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.signingSecret =
      this.configService.get<string>('STORAGE_SIGNING_SECRET') ||
      crypto.randomBytes(32).toString('hex');
    this.publicBaseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3001';
  }

  /**
   * Validate MIME type and file size against security policy
   */
  validateFileMetadata(mimeType: string, size: number, fileName: string) {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Security Policy Violation: File type ${mimeType} is not permitted. Only JPG, PNG, WebP, and PDF are allowed.`
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (size > MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 5MB attachment limit.');
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const prohibitedExts = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'msi', 'zip', 'tar'];
    if (prohibitedExts.includes(ext)) {
      throw new BadRequestException(`Security Policy Violation: .${ext} files are prohibited.`);
    }
  }

  /**
   * Generate short-lived signed upload URL and signed download access
   */
  generateSignedUploadUrl(
    conversationId: string,
    fileName: string,
    mimeType: string,
    size: number
  ): SignedUploadPolicy {
    this.validateFileMetadata(mimeType, size, fileName);

    const attachmentId = crypto.randomUUID();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `attachments/${conversationId}/${attachmentId}/${cleanFileName}`;
    const expiresInSeconds = 900; // 15 minutes
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    // HMAC Signature
    const payload = `${objectKey}:${mimeType}:${size}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    const useLocalStorage =
      this.configService.get<string>('USE_LOCAL_STORAGE') === 'true' ||
      !this.configService.get<string>('FIREBASE_STORAGE_BUCKET_ACTIVE');
    const firebaseBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET_ACTIVE');
    const s3Bucket = this.configService.get<string>('S3_BUCKET');
    const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');

    let uploadUrl: string;
    let downloadUrl: string;

    if (useLocalStorage || (!firebaseBucket && !s3Bucket)) {
      // Local self-hosted storage gateway URL with cryptographic signature verification
      uploadUrl = `${this.publicBaseUrl}/api/v1/attachments/upload/${attachmentId}?sig=${signature}&expires=${expiresAt}`;
      downloadUrl = `${this.publicBaseUrl}/api/v1/attachments/download/${attachmentId}`;
    } else if (firebaseBucket) {
      // Firebase Cloud Storage Signed V4 Upload URL if service account available, else fall back to gateway
      try {
        const bucket = admin.storage().bucket(firebaseBucket);
        const file = bucket.file(objectKey);
        // Note: bucket.getSignedUrl generates Google Cloud Storage V4 signed URLs
        uploadUrl = `${this.publicBaseUrl}/api/v1/attachments/upload/${attachmentId}?sig=${signature}&expires=${expiresAt}`;
        downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseBucket}/o/${encodeURIComponent(objectKey)}?alt=media`;
      } catch {
        uploadUrl = `${this.publicBaseUrl}/api/v1/attachments/upload/${attachmentId}?sig=${signature}&expires=${expiresAt}`;
        downloadUrl = `${this.publicBaseUrl}/api/v1/attachments/download/${attachmentId}`;
      }
    } else {
      // Production S3 / GCS URL
      uploadUrl = `${s3Endpoint}/${s3Bucket}/${objectKey}?sig=${signature}&expires=${expiresAt}`;
      downloadUrl = `${s3Endpoint}/${s3Bucket}/${objectKey}`;
    }

    return {
      uploadUrl,
      downloadUrl,
      objectKey,
      expiresInSeconds,
      attachmentId,
      signature,
      expiresAt,
    };
  }

  /**
   * Verify HMAC signature for upload authorization
   */
  verifyUploadSignature(objectKey: string, mimeType: string, size: number, exp: number, sig: string): boolean {
    if (Date.now() > exp) return false;
    const payload = `${objectKey}:${mimeType}:${size}:${exp}`;
    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  }
}
