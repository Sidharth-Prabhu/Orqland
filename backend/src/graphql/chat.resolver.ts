import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InternalUser } from '../modules/auth/auth.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { MessagesService } from '../modules/messages/messages.service';
import { PresenceService } from '../modules/presence/presence.service';
import { AttachmentsService } from '../modules/attachments/attachments.service';
import { AuthService } from '../modules/auth/auth.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { ChatGateway } from '../gateways/chat.gateway';
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
  OrqspaceGql,
  RegisterPushTokenInputGql,
  RemovePushTokenInputGql,
  ClearConversationHistoryInputGql,
} from './chat.types';

@Resolver()
@UseGuards(FirebaseAuthGuard)
export class ChatResolver {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly presenceService: PresenceService,
    private readonly attachmentsService: AttachmentsService,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  // =====================
  // QUERIES
  // =====================

  @Query(() => [OrqspaceGql], { name: 'chatDirectory', description: 'Active workspaces directory' })
  async getChatDirectory(): Promise<any[]> {
    const list = this.authService.getBusinesses();
    return list.map((b) => ({
      id: b.id,
      orqspaceCode: b.wsid,
      name: b.name,
      logoUrl: b.avatar,
      ownerId: b.id,
      isActive: b.status === 'Open',
      category: b.category,
      description: b.description,
    }));
  }

  @Query(() => [ConversationGql], { name: 'myChatConversations', description: 'List conversations for current user or owned workspace' })
  async myChatConversations(
    @CurrentUser() user: InternalUser,
    @Args('orqspaceId', { type: () => ID, nullable: true }) orqspaceId?: string
  ): Promise<any[]> {
    return this.conversationsService.listUserConversations(user);
  }

  @Query(() => [ConversationGql], { name: 'conversations' })
  async getConversations(@CurrentUser() user: InternalUser): Promise<any[]> {
    return this.conversationsService.listUserConversations(user);
  }

  @Query(() => ConversationGql, { name: 'chatConversation' })
  async chatConversation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.getConversation(id, user);
  }

  @Query(() => ConversationGql, { name: 'conversation' })
  async getConversation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    return this.conversationsService.getConversation(id, user);
  }

  @Query(() => PaginatedMessagesGql, { name: 'chatMessages' })
  async chatMessages(
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @CurrentUser() user: InternalUser,
    @Args('cursor', { nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number = 50
  ): Promise<any> {
    return this.messagesService.getMessages(conversationId, user, limit);
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

  @Query(() => [UserProfileGql], { name: 'businesses' })
  async getBusinesses(): Promise<any[]> {
    return this.authService.getBusinesses();
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
    const message = await this.messagesService.sendMessage(user, input as any);
    await this.chatGateway.broadcastNewMessage(message, user);
    return message;
  }

  @Mutation(() => ChatMessageGql, { name: 'editChatMessage' })
  async editChatMessage(
    @Args('input') input: EditMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const edited = await this.messagesService.editMessage(user, input);
    this.chatGateway.broadcastMessageEdited(input.conversationId, edited);
    return edited;
  }

  @Mutation(() => ChatMessageGql, { name: 'editMessage' })
  async editMessage(
    @Args('input') input: EditMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const edited = await this.messagesService.editMessage(user, input);
    this.chatGateway.broadcastMessageEdited(input.conversationId, edited);
    return edited;
  }

  @Mutation(() => ChatMessageGql, { name: 'deleteChatMessage' })
  async deleteChatMessage(
    @Args('input') input: DeleteMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const deleted = await this.messagesService.deleteMessage(user, input);
    this.chatGateway.broadcastMessageDeleted(input.conversationId, input.messageId);
    return deleted;
  }

  @Mutation(() => ChatMessageGql, { name: 'deleteMessage' })
  async deleteMessage(
    @Args('input') input: DeleteMessageInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const deleted = await this.messagesService.deleteMessage(user, input);
    this.chatGateway.broadcastMessageDeleted(input.conversationId, input.messageId);
    return deleted;
  }

  @Mutation(() => ConversationGql, { name: 'endConversation' })
  async endConversation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const conv = await this.conversationsService.endConversation(id, user);
    this.chatGateway.broadcastConversationUpdated(id, {
      status: 'ended',
      endedBy: user.id,
    });
    return conv;
  }

  @Mutation(() => ConversationGql, { name: 'reopenConversation' })
  async reopenConversation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { nullable: true }) input: ReopenConversationInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const conv = await this.conversationsService.reopenConversation(id, user, {
      conversationId: id,
      workspaceName: input?.workspaceName,
    });
    this.chatGateway.broadcastConversationUpdated(id, {
      status: 'active',
      workspaceName: input?.workspaceName,
    });
    return conv;
  }

  @Mutation(() => Boolean, { name: 'markConversationRead' })
  async markConversationRead(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<boolean> {
    await this.conversationsService.markAsRead(id, user);
    this.chatGateway.broadcastMessageRead(id, user.id);
    return true;
  }

  @Mutation(() => Boolean, { name: 'markConversationAsRead' })
  async markConversationAsRead(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<boolean> {
    await this.conversationsService.markAsRead(id, user);
    this.chatGateway.broadcastMessageRead(id, user.id);
    return true;
  }

  @Mutation(() => ConversationGql, { name: 'clearConversationHistory' })
  async clearConversationHistory(
    @Args('input') input: ClearConversationHistoryInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const conv = await this.conversationsService.deleteChatView(input.conversationId, user);
    this.chatGateway.broadcastConversationUpdated(input.conversationId, {
      clearedAt: Date.now(),
    });
    return conv;
  }

  @Mutation(() => ConversationGql, { name: 'deleteConversationView' })
  async deleteConversationView(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: InternalUser
  ): Promise<any> {
    const conv = await this.conversationsService.deleteChatView(id, user);
    this.chatGateway.broadcastConversationUpdated(id, {
      clearedAt: Date.now(),
    });
    return conv;
  }

  @Mutation(() => Boolean, { name: 'registerPushToken' })
  async registerPushToken(
    @Args('input') input: RegisterPushTokenInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<boolean> {
    await this.notificationsService.registerToken(user.id, input.token, input.platform || 'web', user.email);
    return true;
  }

  @Mutation(() => Boolean, { name: 'removePushToken' })
  async removePushToken(
    @Args('input') input: RemovePushTokenInputGql,
    @CurrentUser() user: InternalUser
  ): Promise<boolean> {
    await this.notificationsService.unregisterToken(input.token);
    return true;
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
