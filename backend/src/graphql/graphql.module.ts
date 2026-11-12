import { Module, forwardRef } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ChatResolver } from './chat.resolver';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { PresenceModule } from '../modules/presence/presence.module';
import { AttachmentsModule } from '../modules/attachments/attachments.module';
import { AuthModule } from '../modules/auth/auth.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { GatewaysModule } from '../gateways/gateways.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(__dirname, 'schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      path: '/graphql',
      context: ({ req, res }: { req: any; res: any }) => ({ req, res }),
    }),
    ConversationsModule,
    MessagesModule,
    PresenceModule,
    AttachmentsModule,
    AuthModule,
    NotificationsModule,
    forwardRef(() => GatewaysModule),
  ],
  providers: [ChatResolver],
  exports: [ChatResolver],
})
export class ChatGraphqlModule {}
