import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';
import { SendMessageDto } from '@orqland/contracts';
import { ChatGateway } from '../../gateways/chat.gateway';

@Controller('messages')
@UseGuards(FirebaseAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  @Get()
  async getMessages(
    @CurrentUser() user: InternalUser,
    @Query('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('beforeTimestamp') beforeTimestamp?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedBefore = beforeTimestamp ? parseInt(beforeTimestamp, 10) : undefined;
    const data = await this.messagesService.getMessages(
      conversationId,
      user,
      parsedLimit,
      parsedBefore
    );
    return { success: true, ...data };
  }

  @Post()
  async sendMessage(
    @CurrentUser() user: InternalUser,
    @Body() dto: SendMessageDto
  ) {
    const data = await this.messagesService.sendMessage(user, dto);

    // Broadcast in realtime to conversation room and direct recipient personal user room
    try {
      await this.chatGateway.broadcastNewMessage(data, user);
    } catch (broadcastErr) {
      console.warn('Realtime broadcast failed:', broadcastErr);
    }

    return { success: true, data };
  }

  @Patch(':id')
  async editMessage(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser,
    @Body() body: { conversationId: string; content: string }
  ) {
    const data = await this.messagesService.editMessage(user, {
      conversationId: body.conversationId,
      messageId: id,
      content: body.content,
    });
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser,
    @Body() body: { conversationId: string }
  ) {
    const data = await this.messagesService.deleteMessage(user, {
      conversationId: body.conversationId,
      messageId: id,
    });
    return { success: true, data };
  }
}
