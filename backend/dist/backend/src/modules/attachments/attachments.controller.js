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
exports.AttachmentsController = void 0;
const common_1 = require("@nestjs/common");
const attachments_service_1 = require("./attachments.service");
const firebase_auth_guard_1 = require("../../common/guards/firebase-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const localFileStore = new Map();
let AttachmentsController = class AttachmentsController {
    attachmentsService;
    constructor(attachmentsService) {
        this.attachmentsService = attachmentsService;
    }
    async requestUploadUrl(user, body) {
        if (!body.conversationId || !body.fileName || !body.mimeType || !body.size) {
            throw new common_1.BadRequestException('Missing required attachment parameters.');
        }
        const policy = await this.attachmentsService.requestSignedUpload(user.id, body.conversationId, body.fileName, body.mimeType, body.size);
        return {
            success: true,
            ...policy,
        };
    }
    async handleDirectUpload(id, req, res) {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const mimeType = req.headers['content-type'] || 'application/octet-stream';
            localFileStore.set(id, { buffer, mimeType });
            return res.status(200).json({ success: true, attachmentId: id });
        });
    }
    async handleDirectDownload(id, res) {
        const item = localFileStore.get(id);
        if (!item) {
            return res.status(404).send('Attachment not found or expired.');
        }
        res.setHeader('Content-Type', item.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(item.buffer);
    }
};
exports.AttachmentsController = AttachmentsController;
__decorate([
    (0, common_1.Post)('request-upload'),
    (0, common_1.UseGuards)(firebase_auth_guard_1.FirebaseAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "requestUploadUrl", null);
__decorate([
    (0, common_1.Put)('upload/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "handleDirectUpload", null);
__decorate([
    (0, common_1.Get)('download/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "handleDirectDownload", null);
exports.AttachmentsController = AttachmentsController = __decorate([
    (0, common_1.Controller)('api/attachments'),
    __metadata("design:paramtypes", [attachments_service_1.AttachmentsService])
], AttachmentsController);
//# sourceMappingURL=attachments.controller.js.map