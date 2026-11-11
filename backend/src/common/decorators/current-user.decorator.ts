import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InternalUser } from '../../modules/auth/auth.service';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): InternalUser => {
    // Check GraphQL context first if present
    try {
      const gqlCtx = GqlExecutionContext.create(ctx);
      const gqlReq = gqlCtx.getContext()?.req;
      if (gqlReq?.user) {
        return gqlReq.user;
      }
    } catch {
      // not a GraphQL context
    }

    // Check HTTP request
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
