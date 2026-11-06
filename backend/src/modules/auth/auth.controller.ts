import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService, InternalUser } from './auth.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getMe(@CurrentUser() user: InternalUser) {
    return { success: true, data: user };
  }

  @Post('sync')
  async syncProfile(@Body() body: { email: string; name?: string; avatar?: string }) {
    const user = await this.authService.syncUserProfile(
      body.email,
      body.name,
      body.avatar
    );
    return { success: true, user };
  }
}
