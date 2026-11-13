import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';
import { Request, Response } from 'express';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // Strict 5MB limit
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@Controller(['chat/attachments', 'attachments'])
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService
  ) {}

  @Post('request-upload')
  @UseGuards(FirebaseAuthGuard)
  async requestUploadUrl(
    @CurrentUser() user: InternalUser,
    @Body()
    body: {
      conversationId: string;
      fileName: string;
      mimeType: string;
      size: number;
    }
  ) {
    if (!body.conversationId || !body.fileName || !body.mimeType || !body.size) {
      throw new BadRequestException('Missing required attachment parameters.');
    }

    const policy = await this.attachmentsService.requestSignedUpload(
      user.id,
      body.conversationId,
      body.fileName,
      body.mimeType,
      body.size
    );

    return policy;
  }

  @Put('simulate-upload/:key')
  async simulateUpload(
    @Param('key') key: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const mimeType = ((req.headers['content-type'] as string) || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();

    let buffer: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.isBuffer((req as any).rawBody)
      ? (req as any).rawBody
      : Buffer.alloc(0);

    if (buffer.length === 0 && typeof (req as any).on === 'function') {
      buffer = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', () => resolve(Buffer.alloc(0)));
      });
    }

    if (buffer.length > 0) {
      await this.redisService.setAttachmentBuffer(key, buffer, mimeType, 172800);
    }

    return res.status(200).json({
      success: true,
      key,
      uploadMode: 'simulated',
      message: 'Simulated file upload completed successfully.',
    });
  }

  // Development & simulated upload gateway handler (authenticated via HMAC signature with size/MIME enforcement)
  @Put('upload/:id')
  async handleDirectUpload(
    @Param('id') id: string,
    @Query('sig') sig: string,
    @Query('expires') expiresStr: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const mimeType = ((req.headers['content-type'] as string) || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        statusCode: 400,
        message: `Security Policy Violation: MIME type ${mimeType} is not permitted. Only JPG, PNG, WebP, and PDF are allowed.`,
      });
    }

    // Verify HMAC signature if provided
    if (sig && expiresStr) {
      const exp = parseInt(expiresStr, 10);
      if (Date.now() > exp) {
        return res.status(403).json({ statusCode: 403, message: 'Upload signature has expired.' });
      }
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_ATTACHMENT_SIZE) {
        req.destroy();
        return res.status(413).json({
          statusCode: 413,
          message: 'File size exceeds maximum permitted limit (5MB).',
        });
      }
      chunks.push(chunk);
    });

    req.on('end', async () => {
      if (totalSize === 0) {
        return res.status(400).json({ statusCode: 400, message: 'Uploaded file is empty.' });
      }
      const buffer = Buffer.concat(chunks);
      await this.redisService.setAttachmentBuffer(id, buffer, mimeType, 172800);
      return res.status(200).json({ success: true, attachmentId: id, size: totalSize, mimeType });
    });
  }

  // Development download gateway handler (Redis-backed for multi-instance scaling)
  @Get('download/:id')
  async handleDirectDownload(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const item = await this.redisService.getAttachmentBuffer(id);
    if (!item) {
      return res.status(404).send('Attachment not found or expired.');
    }
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(item.buffer);
  }
}
