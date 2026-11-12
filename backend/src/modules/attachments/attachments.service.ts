import { Injectable, ForbiddenException } from '@nestjs/common';
import { StorageService, SignedUploadPolicy } from '../../infrastructure/storage/storage.service';
import { ChatStorageProvider } from '../../infrastructure/storage/chat-storage.provider';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { chatConversations, orqspaces } from '../../infrastructure/database/schema';
import { eq, and, or } from 'drizzle-orm';
import * as crypto from 'crypto';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly chatStorageProvider: ChatStorageProvider,
    private readonly dbService: DatabaseService
  ) {}

  async requestSignedUpload(
    userId: string,
    conversationId: string,
    fileName: string,
    mimeType: string,
    size: number
  ): Promise<SignedUploadPolicy> {
    // 1. Verify user is participant in conversation if database is connected
    if (this.dbService.isDbConnected()) {
      const db = this.dbService.getDb();
      const membership = await db
        .select()
        .from(chatConversations)
        .innerJoin(orqspaces, eq(chatConversations.orqspaceId, orqspaces.id))
        .where(
          and(
            eq(chatConversations.id, conversationId),
            or(
              eq(chatConversations.clientUserId, userId),
              eq(orqspaces.ownerId, userId)
            )
          )
        )
        .limit(1);

      if (membership.length === 0) {
        throw new ForbiddenException('You are not an authorized participant in this conversation.');
      }
    }

    // 2. Delegate to ChatStorageProvider (enforces size <= 5MB, MIME, dangerous extension checks)
    const policy = await this.chatStorageProvider.createUploadPolicy({
      conversationId,
      fileName,
      mimeType,
      sizeBytes: size,
    });

    const attachmentId = crypto.randomUUID();

    return {
      uploadUrl: policy.uploadUrl,
      downloadUrl: policy.url,
      objectKey: policy.storageKey,
      expiresInSeconds: 48 * 3600,
      attachmentId,
      expiresAt: policy.expiresAt.getTime(),
    };
  }
}
