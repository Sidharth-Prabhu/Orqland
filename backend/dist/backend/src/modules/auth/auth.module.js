"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const firebase_admin_service_1 = require("./firebase-admin.service");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const firebase_auth_guard_1 = require("../../common/guards/firebase-auth.guard");
const ws_auth_guard_1 = require("../../common/guards/ws-auth.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [auth_controller_1.AuthController],
        providers: [firebase_admin_service_1.FirebaseAdminService, auth_service_1.AuthService, firebase_auth_guard_1.FirebaseAuthGuard, ws_auth_guard_1.WsAuthGuard],
        exports: [firebase_admin_service_1.FirebaseAdminService, auth_service_1.AuthService, firebase_auth_guard_1.FirebaseAuthGuard, ws_auth_guard_1.WsAuthGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map