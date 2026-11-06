"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WsAuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const firebase_admin_service_1 = require("../../modules/auth/firebase-admin.service");
const auth_service_1 = require("../../modules/auth/auth.service");
let WsAuthGuard = WsAuthGuard_1 = class WsAuthGuard {
    firebaseAdmin;
    authService;
    logger = new common_1.Logger(WsAuthGuard_1.name);
    constructor(firebaseAdmin, authService) {
        this.firebaseAdmin = firebaseAdmin;
        this.authService = authService;
    }
    async canActivate(context) {
        const client = context.switchToWs().getClient();
        const token = client.handshake?.auth?.token ||
            client.handshake?.headers?.authorization;
        if (!token) {
            throw new websockets_1.WsException('Unauthorized: WebSocket token missing in handshake.');
        }
        try {
            const decoded = await this.firebaseAdmin.verifyIdToken(token);
            const user = await this.authService.resolveOrCreateUser(decoded);
            client.data.user = user;
            return true;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`WS connection rejected for socket ${client.id}: ${msg}`);
            throw new websockets_1.WsException('Unauthorized: Invalid or expired WebSocket handshake token.');
        }
    }
};
exports.WsAuthGuard = WsAuthGuard;
exports.WsAuthGuard = WsAuthGuard = WsAuthGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [firebase_admin_service_1.FirebaseAdminService,
        auth_service_1.AuthService])
], WsAuthGuard);
//# sourceMappingURL=ws-auth.guard.js.map