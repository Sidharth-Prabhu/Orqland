import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StorageService, SignedUploadPolicy } from '../../infrastructure/storage/storage.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { conversationParticipants, messageAttachments } from '../../infrastructure/database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly dbService: DatabaseService
  ) {}

  async requestSignedUpload(
    userId: string,
    conversationId: string,
    fileName: string,
    mimeType: string,
    size: number
  ): Promise<SignedUploadPolicy> {
    // 1. Verify user is participant in conversation
    if (this.dbService.isDbConnected()) {
      const db = this.dbService.getDb();
      const membership = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, userId)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        throw new ForbiddenException('You are not an authorized participant in this conversation.');
      }
    }

    // 2. Generate signed policy
    return this.storageService.generateSignedUploadUrl(
      conversationId,
      fileName,
      mimeType,
      size
    );
  }
}
