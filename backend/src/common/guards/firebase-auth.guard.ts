import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAdminService } from '../../modules/auth/firebase-admin.service';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required.');
    }

    const decoded = await this.firebaseAdmin.verifyIdToken(authHeader);
    const user = await this.authService.resolveOrCreateUser(decoded);

    // Attach validated internal ORQLAND user (with internal UUID) to request
    req.user = user;
    return true;
  }
}
