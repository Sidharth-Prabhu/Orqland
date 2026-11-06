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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceController = void 0;
const common_1 = require("@nestjs/common");
const presence_service_1 = require("./presence.service");
const firebase_auth_guard_1 = require("../../common/guards/firebase-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let PresenceController = class PresenceController {
    presenceService;
    constructor(presenceService) {
        this.presenceService = presenceService;
    }
    async heartbeat(user) {
        await this.presenceService.recordHeartbeat(user.id, user.email);
        return { success: true, timestamp: Date.now() };
    }
};
exports.PresenceController = PresenceController;
__decorate([
    (0, common_1.Post)('heartbeat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "heartbeat", null);
exports.PresenceController = PresenceController = __decorate([
    (0, common_1.Controller)('api/user'),
    (0, common_1.UseGuards)(firebase_auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [presence_service_1.PresenceService])
], PresenceController);
//# sourceMappingURL=presence.controller.js.map