import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { FirebaseAdminService } from '../../modules/auth/firebase-admin.service';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization;

    if (!token) {
      throw new WsException('Unauthorized: WebSocket token missing in handshake.');
    }

    try {
      const decoded = await this.firebaseAdmin.verifyIdToken(token);
      const user = await this.authService.resolveOrCreateUser(decoded);
      // Store internal user on socket.data
      client.data.user = user;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS connection rejected for socket ${client.id}: ${msg}`);
      throw new WsException('Unauthorized: Invalid or expired WebSocket handshake token.');
    }
  }
}
