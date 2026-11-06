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
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';
import { Request, Response } from 'express';

// In-memory file storage buffer for dev gateway upload/download
const localFileStore = new Map<string, { buffer: Buffer; mimeType: string }>();

@Controller('api/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

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

    return {
      success: true,
      ...policy,
    };
  }

  // Development upload gateway handler
  @Put('upload/:id')
  async handleDirectUpload(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const mimeType = req.headers['content-type'] || 'application/octet-stream';
      localFileStore.set(id, { buffer, mimeType });
      return res.status(200).json({ success: true, attachmentId: id });
    });
  }

  // Development download gateway handler
  @Get('download/:id')
  async handleDirectDownload(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const item = localFileStore.get(id);
    if (!item) {
      return res.status(404).send('Attachment not found or expired.');
    }
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(item.buffer);
  }
}
