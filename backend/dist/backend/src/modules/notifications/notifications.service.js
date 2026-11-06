"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    logger = new common_1.Logger(NotificationsService_1.name);
    async sendPushNotification(params) {
        if (!params.recipientToken)
            return;
        try {
            await admin.messaging().send({
                token: params.recipientToken,
                notification: {
                    title: `New message from ${params.senderName}`,
                    body: params.hasAttachment ? 'Sent an attachment' : 'Sent you a new message',
                },
                data: {
                    conversationId: params.conversationId,
                    type: 'chat_message',
                },
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.debug(`FCM push notification skipped/failed: ${msg}`);
        }
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map