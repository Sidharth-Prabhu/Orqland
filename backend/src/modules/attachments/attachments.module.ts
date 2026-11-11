import { Module, forwardRef } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentPurgeCronService } from './attachment-purge-cron.service';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    RedisModule,
    DatabaseModule,
    StorageModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentPurgeCronService],
  exports: [AttachmentsService, AttachmentPurgeCronService],
})
export class AttachmentsModule {}
