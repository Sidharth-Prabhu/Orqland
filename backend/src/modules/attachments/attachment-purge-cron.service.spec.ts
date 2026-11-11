import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentPurgeCronService } from './attachment-purge-cron.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MessagesService } from '../messages/messages.service';

describe('AttachmentPurgeCronService', () => {
  let service: AttachmentPurgeCronService;
  let dbService: any;
  let storageService: any;
  let redisService: any;
  let messagesService: any;

  beforeEach(async () => {
    dbService = {
      isDbConnected: jest.fn().mockReturnValue(false),
      getDb: jest.fn(),
    };

    storageService = {
      deleteObject: jest.fn().mockResolvedValue(true),
    };

    redisService = {
      deleteAttachmentBuffer: jest.fn().mockResolvedValue(undefined),
    };

    messagesService = {
      purgeExpiredAttachments: jest.fn().mockResolvedValue({ purgedCount: 2 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentPurgeCronService,
        { provide: DatabaseService, useValue: dbService },
        { provide: StorageService, useValue: storageService },
        { provide: RedisService, useValue: redisService },
        { provide: MessagesService, useValue: messagesService },
      ],
    }).compile();

    service = module.get<AttachmentPurgeCronService>(AttachmentPurgeCronService);
  });

  it('should execute purge cron task successfully', async () => {
    await service.handlePurgeCron();
    expect(messagesService.purgeExpiredAttachments).toHaveBeenCalled();
  });
});
