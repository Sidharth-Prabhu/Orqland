import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { PresenceModule } from './modules/presence/presence.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { HealthModule } from './modules/health/health.module';
import { ChatGateway } from './gateways/chat.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    RedisModule,
    StorageModule,
    AuthModule,
    PresenceModule,
    AttachmentsModule,
    NotificationsModule,
    ConversationsModule,
    MessagesModule,
    HealthModule,
  ],
  providers: [ChatGateway],
})
export class AppModule {}
