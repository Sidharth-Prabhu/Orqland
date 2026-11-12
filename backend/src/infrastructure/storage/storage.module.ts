import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import {
  ChatStorageProvider,
  SimulatedChatStorageProvider,
} from './chat-storage.provider';

@Global()
@Module({
  providers: [
    StorageService,
    {
      provide: ChatStorageProvider,
      useClass: SimulatedChatStorageProvider,
    },
  ],
  exports: [StorageService, ChatStorageProvider],
})
export class StorageModule {}
