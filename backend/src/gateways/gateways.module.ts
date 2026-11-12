import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../modules/messages/messages.module';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { PresenceModule } from '../modules/presence/presence.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
  imports: [
    forwardRef(() => MessagesModule),
    forwardRef(() => ConversationsModule),
    PresenceModule,
    NotificationsModule,
    AuthModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewaysModule {}
