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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsService = void 0;
const common_1 = require("@nestjs/common");
const storage_service_1 = require("../../infrastructure/storage/storage.service");
const database_service_1 = require("../../infrastructure/database/database.service");
const schema_1 = require("../../infrastructure/database/schema");
const drizzle_orm_1 = require("drizzle-orm");
let AttachmentsService = class AttachmentsService {
    storageService;
    dbService;
    constructor(storageService, dbService) {
        this.storageService = storageService;
        this.dbService = dbService;
    }
    async requestSignedUpload(userId, conversationId, fileName, mimeType, size) {
        if (this.dbService.isDbConnected()) {
            const db = this.dbService.getDb();
            const membership = await db
                .select()
                .from(schema_1.conversationParticipants)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.conversationParticipants.conversationId, conversationId), (0, drizzle_orm_1.eq)(schema_1.conversationParticipants.userId, userId)))
                .limit(1);
            if (membership.length === 0) {
                throw new common_1.ForbiddenException('You are not an authorized participant in this conversation.');
            }
        }
        return this.storageService.generateSignedUploadUrl(conversationId, fileName, mimeType, size);
    }
};
exports.AttachmentsService = AttachmentsService;
exports.AttachmentsService = AttachmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        database_service_1.DatabaseService])
], AttachmentsService);
//# sourceMappingURL=attachments.service.js.map