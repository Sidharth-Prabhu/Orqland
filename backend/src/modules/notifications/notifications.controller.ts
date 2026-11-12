import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @UseGuards(FirebaseAuthGuard)
  async registerPushToken(
    @CurrentUser() user: InternalUser,
    @Body() body: { token: string; deviceType?: string }
  ) {
    if (!body?.token || typeof body.token !== 'string') {
      throw new BadRequestException('Valid FCM push token is required.');
    }

    await this.notificationsService.registerToken(user.id, body.token.trim(), body.deviceType, user.email);
    return { success: true, message: 'Push token registered successfully.' };
  }

  @Delete('unregister-token')
  @UseGuards(FirebaseAuthGuard)
  async unregisterPushToken(
    @CurrentUser() user: InternalUser,
    @Body() body: { token: string }
  ) {
    if (!body?.token) {
      throw new BadRequestException('Token is required to unregister.');
    }

    await this.notificationsService.unregisterToken(body.token.trim());
    return { success: true, message: 'Push token unregistered successfully.' };
  }
}
