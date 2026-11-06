import { CanActivate, ExecutionContext } from '@nestjs/common';
import { FirebaseAdminService } from '../../modules/auth/firebase-admin.service';
import { AuthService } from '../../modules/auth/auth.service';
export declare class FirebaseAuthGuard implements CanActivate {
    private readonly firebaseAdmin;
    private readonly authService;
    constructor(firebaseAdmin: FirebaseAdminService, authService: AuthService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
