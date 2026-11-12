import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';
import { InitiateConversationDto, ReopenConversationDto } from '@orqland/contracts';
import { ChatGateway } from '../../gateways/chat.gateway';

@Controller('conversations')
@UseGuards(FirebaseAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async listConversations(@CurrentUser() user: InternalUser) {
    const data = await this.conversationsService.listUserConversations(user);
    return { success: true, data };
  }

  @Post()
  async initiateConversation(
    @CurrentUser() user: InternalUser,
    @Body() dto: InitiateConversationDto
  ) {
    const data = await this.conversationsService.initiateConversation(user, dto);
    return { success: true, data };
  }

  @Get(':id')
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser
  ) {
    const data = await this.conversationsService.getConversation(id, user);
    return { success: true, data };
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async endConversation(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser
  ) {
    const data = await this.conversationsService.endConversation(id, user);

    // Broadcast to conversation room and participants in real-time
    try {
      const otherParticipantId = data.clientId === user.id ? data.businessId : data.clientId;
      const otherParticipantEmail = data.clientId === user.id ? data.businessEmail : data.clientEmail;
      await this.chatGateway.broadcastConversationUpdated(id, {
        status: 'ended',
        endedAt: data.endedAt || Date.now(),
        endedBy: user.id,
        participantId: otherParticipantId,
        participantEmail: otherParticipantEmail,
      });
    } catch (broadcastErr) {
      console.warn('Realtime broadcast failed for endConversation:', broadcastErr);
    }

    return { success: true, data };
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  async reopenConversation(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser,
    @Body() dto: ReopenConversationDto
  ) {
    const data = await this.conversationsService.reopenConversation(id, user, dto);

    // Broadcast to conversation room and participants in real-time
    try {
      const otherParticipantId = data.clientId === user.id ? data.businessId : data.clientId;
      const otherParticipantEmail = data.clientId === user.id ? data.businessEmail : data.clientEmail;
      await this.chatGateway.broadcastConversationUpdated(id, {
        status: 'active',
        endedAt: null,
        endedBy: null,
        workspaceName: dto?.workspaceName || data.workspaceInfo?.name,
        participantId: otherParticipantId,
        participantEmail: otherParticipantEmail,
      });
    } catch (broadcastErr) {
      console.warn('Realtime broadcast failed for reopenConversation:', broadcastErr);
    }

    return { success: true, data };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser
  ) {
    await this.conversationsService.markAsRead(id, user);
    try {
      this.chatGateway.broadcastMessageRead(id, user.id);
    } catch (broadcastErr) {
      console.warn('Realtime broadcast failed for markAsRead:', broadcastErr);
    }
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteChatView(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser
  ) {
    const data = await this.conversationsService.deleteChatView(id, user);
    try {
      await this.chatGateway.broadcastConversationUpdated(id, {
        clearedAt: Date.now(),
      });
    } catch {}
    return { success: true, data };
  }
}
