import { AuthService, InternalUser } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    getMe(user: InternalUser): Promise<{
        success: boolean;
        data: InternalUser;
    }>;
    syncProfile(body: {
        email: string;
        name?: string;
        avatar?: string;
    }): Promise<{
        success: boolean;
        user: InternalUser;
    }>;
}
