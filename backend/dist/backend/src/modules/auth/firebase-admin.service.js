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
var FirebaseAdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseAdminService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const admin = require("firebase-admin");
let FirebaseAdminService = FirebaseAdminService_1 = class FirebaseAdminService {
    configService;
    logger = new common_1.Logger(FirebaseAdminService_1.name);
    firebaseApp = null;
    isConfigured = false;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const projectId = this.configService.get('FIREBASE_PROJECT_ID') || 'openpurpl-f8dd3';
        const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY');
        try {
            if (admin.apps.length > 0) {
                this.firebaseApp = admin.apps[0];
                this.isConfigured = true;
                return;
            }
            if (clientEmail && privateKey) {
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        clientEmail,
                        privateKey: privateKey.replace(/\\n/g, '\n'),
                    }),
                });
                this.isConfigured = true;
                this.logger.log(`Firebase Admin initialized with service account for project: ${projectId}`);
            }
            else {
                this.firebaseApp = admin.initializeApp({ projectId });
                this.isConfigured = true;
                this.logger.log(`Firebase Admin initialized with project ID: ${projectId}`);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Firebase Admin initialization notice: ${msg}`);
            this.isConfigured = false;
        }
    }
    async verifyIdToken(token) {
        if (!token) {
            throw new common_1.UnauthorizedException('Authentication token is missing.');
        }
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
        if (process.env.NODE_ENV !== 'production' &&
            cleanToken.startsWith('mock-token-')) {
            const email = cleanToken.replace('mock-token-', '');
            return {
                uid: `mock-uid-${email}`,
                email,
                name: email.split('@')[0],
            };
        }
        if (!this.isConfigured || !this.firebaseApp) {
            return this.decodeDevToken(cleanToken);
        }
        try {
            const decoded = await admin.auth().verifyIdToken(cleanToken);
            return decoded;
        }
        catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                return this.decodeDevToken(cleanToken);
            }
            const msg = err instanceof Error ? err.message : 'Invalid or expired Firebase token.';
            this.logger.warn(`Token verification failed: ${msg}`);
            throw new common_1.UnauthorizedException('Authentication failed: Invalid or expired token.');
        }
    }
    decodeDevToken(token) {
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                if (payload.user_id || payload.sub) {
                    return {
                        uid: payload.user_id || payload.sub,
                        email: payload.email,
                        name: payload.name,
                        picture: payload.picture,
                    };
                }
            }
        }
        catch {
        }
        throw new common_1.UnauthorizedException('Invalid or expired authentication token.');
    }
};
exports.FirebaseAdminService = FirebaseAdminService;
exports.FirebaseAdminService = FirebaseAdminService = FirebaseAdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FirebaseAdminService);
//# sourceMappingURL=firebase-admin.service.js.map