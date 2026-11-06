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
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';
import { InitiateConversationDto, ReopenConversationDto } from '@orqland/contracts';

@Controller('conversations')
@UseGuards(FirebaseAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

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
    return { success: true, data };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser
  ) {
    await this.conversationsService.markAsRead(id, user);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteChatView(
    @Param('id') id: string,
    @CurrentUser() user: InternalUser
  ) {
    const data = await this.conversationsService.deleteChatView(id, user);
    return { success: true, data };
  }
}
