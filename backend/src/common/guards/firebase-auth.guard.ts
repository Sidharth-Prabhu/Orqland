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
    const emailHeader = (req?.headers?.['x-user-email'] as string | undefined)?.trim();
    const bodyEmail = (req?.body?.clientEmail || req?.body?.email || req?.body?.senderEmail) as string | undefined;

    // In development mode, provide a fallback if no auth token is attached yet
    if (!authHeader) {
      if (process.env.NODE_ENV !== 'production' && (emailHeader || bodyEmail)) {
        const userEmail = emailHeader || bodyEmail!;
        const user = await this.authService.resolveOrCreateUser({
          uid: `dev-user-${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: userEmail,
          name: userEmail.split('@')[0],
        });
        req.user = user;
        return true;
      }
      throw new UnauthorizedException('Authorization header is required.');
    }

    try {
      const decoded = await this.firebaseAdmin.verifyIdToken(authHeader);
      const user = await this.authService.resolveOrCreateUser(decoded);

      // Attach validated internal ORQLAND user (with internal UUID) to request
      req.user = user;
      return true;
    } catch (err: unknown) {
      // In development, if verification fails but an email identifier is provided, fall back gracefully
      if (process.env.NODE_ENV !== 'production' && (emailHeader || bodyEmail)) {
        const userEmail = emailHeader || bodyEmail!;
        const user = await this.authService.resolveOrCreateUser({
          uid: `dev-fallback-${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: userEmail,
          name: userEmail.split('@')[0],
        });
        req.user = user;
        return true;
      }
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Authentication failed.');
    }
  }
}
