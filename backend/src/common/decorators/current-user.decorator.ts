import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { InternalUser } from '../../modules/auth/auth.service';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): InternalUser => {
    // Check HTTP request first
    const req = ctx.switchToHttp().getRequest();
    if (req?.user) {
      return req.user;
    }
    // Check WebSocket client
    const wsClient = ctx.switchToWs().getClient();
    if (wsClient?.data?.user) {
      return wsClient.data.user;
    }
    throw new Error('CurrentUser decorator called without authenticated user context');
  }
);
