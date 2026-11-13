import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FirebaseAdminService } from '../../modules/auth/firebase-admin.service';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if GraphQL context
    let req = context.switchToHttp().getRequest();
    if (!req || !req.headers) {
      const gqlContext = GqlExecutionContext.create(context);
      req = gqlContext.getContext()?.req;
    }
    const authHeader = req?.headers?.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required.');
    }

    try {
      const decoded = await this.firebaseAdmin.verifyIdToken(authHeader);
      const user = await this.authService.resolveOrCreateUser(decoded);

      // Attach validated internal ORQLAND user (with internal UUID) to request
      req.user = user;
      return true;
    } catch (err: unknown) {
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Authentication failed.');
    }
  }
}
