"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("./infrastructure/database/database.module");
const redis_module_1 = require("./infrastructure/redis/redis.module");
const storage_module_1 = require("./infrastructure/storage/storage.module");
const auth_module_1 = require("./modules/auth/auth.module");
const presence_module_1 = require("./modules/presence/presence.module");
const attachments_module_1 = require("./modules/attachments/attachments.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const messages_module_1 = require("./modules/messages/messages.module");
const health_module_1 = require("./modules/health/health.module");
const chat_gateway_1 = require("./gateways/chat.gateway");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
            storage_module_1.StorageModule,
            auth_module_1.AuthModule,
            presence_module_1.PresenceModule,
            attachments_module_1.AttachmentsModule,
            notifications_module_1.NotificationsModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            health_module_1.HealthModule,
        ],
        providers: [chat_gateway_1.ChatGateway],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map