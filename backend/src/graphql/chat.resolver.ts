import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InternalUser } from '../modules/auth/auth.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { MessagesService } from '../modules/messages/messages.service';
import { PresenceService } from '../modules/presence/presence.service';
import { AttachmentsService } from '../modules/attachments/attachments.service';
import { AuthService } from '../modules/auth/auth.service';
import {
  ConversationGql,
  ChatMessageGql,
  PaginatedMessagesGql,
  UserProfileGql,
  SignedUploadPolicyGql,
  HeartbeatResultGql,
  InitiateConversationInputGql,
  SendMessageInputGql,
  EditMessageInputGql,
  DeleteMessageInputGql,
  ReopenConversationInputGql,
  RequestSignedUploadInputGql,
} from './chat.types';

@Resolver()
@UseGuards(FirebaseAuthGuard)
export class ChatResolver {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly presenceService: PresenceService,
    private readonly attachmentsService: AttachmentsService,
    private readonly authService: AuthService
  ) {}

  // =====================
  // QUERIES
  // =====================

  @Query(() => [ConversationGql], { name: 'conversations' })
  async getConversations(@CurrentUser() user: InternalUser): Promise<any[]> {
    return this.conversationsService.listUserConversations(user);
  }

  @Query(() => ConversationGql, { name: 'conversation' })
  async getConversation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.getConversation(id, user);
  }

  @Query(() => PaginatedMessagesGql, { name: 'messages' })
  async getMessages(
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @CurrentUser() user: InternalUser,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
    @Args('beforeTimestamp', { type: () => Float, nullable: true }) beforeTimestamp?: number
  ): Promise<any> {
    return this.messagesService.getMessages(conversationId, user, limit, beforeTimestamp);
  }

  @Query(() => UserProfileGql, { name: 'me' })
  async getMe(@CurrentUser() user: InternalUser): Promise<any> {
    const isOnline = await this.presenceService.isOnline(user.id);
    return {
      ...user,
      isOnline,
    };
  }

  // =====================
  // MUTATIONS
  // =====================

  @Mutation(() => ConversationGql, { name: 'initiateConversation' })
  async initiateConversation(
    @Args('input') input: InitiateConversationInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.initiateConversation(user, input as any);
  }

  @Mutation(() => ChatMessageGql, { name: 'sendMessage' })
  async sendMessage(
    @Args('input') input: SendMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.messagesService.sendMessage(user, input as any);
  }

  @Mutation(() => ChatMessageGql, { name: 'editMessage' })
  async editMessage(
    @Args('input') input: EditMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.messagesService.editMessage(user, input);
  }

  @Mutation(() => ChatMessageGql, { name: 'deleteMessage' })
  async deleteMessage(
    @Args('input') input: DeleteMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.messagesService.deleteMessage(user, input);
  }

  @Mutation(() => ConversationGql, { name: 'endConversation' })
  async endConversation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.endConversation(id, user);
  }

  @Mutation(() => ConversationGql, { name: 'reopenConversation' })
  async reopenConversation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { nullable: true }) input: ReopenConversationInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.reopenConversation(id, user, {
      conversationId: id,
      workspaceName: input?.workspaceName,
    });
  }

  @Mutation(() => Boolean, { name: 'markConversationAsRead' })
  async markConversationAsRead(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<boolean> {
    await this.conversationsService.markAsRead(id, user);
    return true;
  }

  @Mutation(() => ConversationGql, { name: 'deleteConversationView' })
  async deleteConversationView(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.deleteChatView(id, user);
  }

  @Mutation(() => SignedUploadPolicyGql, { name: 'requestSignedUpload' })
  async requestSignedUpload(
    @Args('input') input: RequestSignedUploadInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.attachmentsService.requestSignedUpload(
      user.id,
      input.conversationId,
      input.fileName,
      input.mimeType,
      input.size
    );
  }

  @Mutation(() => HeartbeatResultGql, { name: 'heartbeat' })
  async recordHeartbeat(@CurrentUser() user: InternalUser): Promise<any> {
    await this.presenceService.recordHeartbeat(user.id, user.email);
    return { success: true, timestamp: Date.now() };
  }
}
