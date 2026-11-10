import { Controller, Post, UseGuards } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalUser } from '../auth/auth.service';

@Controller('presence')
@UseGuards(FirebaseAuthGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('heartbeat')
  async heartbeat(@CurrentUser() user: InternalUser) {
    await this.presenceService.recordHeartbeat(user.id, user.email);
    return { success: true, timestamp: Date.now() };
  }
}
