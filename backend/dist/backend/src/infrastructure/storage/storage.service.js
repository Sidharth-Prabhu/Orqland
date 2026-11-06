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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
let StorageService = StorageService_1 = class StorageService {
    configService;
    logger = new common_1.Logger(StorageService_1.name);
    signingSecret;
    publicBaseUrl;
    constructor(configService) {
        this.configService = configService;
        this.signingSecret =
            this.configService.get('STORAGE_SIGNING_SECRET') ||
                crypto.randomBytes(32).toString('hex');
        this.publicBaseUrl =
            this.configService.get('APP_URL') || 'http://localhost:3001';
    }
    validateFileMetadata(mimeType, size, fileName) {
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
        ];
        if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
            throw new common_1.BadRequestException(`Security Policy Violation: File type ${mimeType} is not permitted. Only JPG, PNG, WebP, and PDF are allowed.`);
        }
        const MAX_SIZE = 10 * 1024 * 1024;
        if (size > MAX_SIZE) {
            throw new common_1.BadRequestException('File size exceeds the 10MB attachment limit.');
        }
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const prohibitedExts = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'msi', 'zip', 'tar'];
        if (prohibitedExts.includes(ext)) {
            throw new common_1.BadRequestException(`Security Policy Violation: .${ext} files are prohibited.`);
        }
    }
    generateSignedUploadUrl(conversationId, fileName, mimeType, size) {
        this.validateFileMetadata(mimeType, size, fileName);
        const attachmentId = crypto.randomUUID();
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const objectKey = `attachments/${conversationId}/${attachmentId}/${cleanFileName}`;
        const expiresInSeconds = 900;
        const expiresAt = Date.now() + expiresInSeconds * 1000;
        const payload = `${objectKey}:${mimeType}:${size}:${expiresAt}`;
        const signature = crypto
            .createHmac('sha256', this.signingSecret)
            .update(payload)
            .digest('hex');
        const s3Bucket = this.configService.get('S3_BUCKET');
        const s3Endpoint = this.configService.get('S3_ENDPOINT');
        let uploadUrl;
        let downloadUrl;
        if (s3Bucket && s3Endpoint) {
            uploadUrl = `${s3Endpoint}/${s3Bucket}/${objectKey}?sig=${signature}&expires=${expiresAt}`;
            downloadUrl = `${s3Endpoint}/${s3Bucket}/${objectKey}`;
        }
        else {
            uploadUrl = `${this.publicBaseUrl}/api/attachments/upload/${attachmentId}?key=${encodeURIComponent(objectKey)}&sig=${signature}&exp=${expiresAt}`;
            downloadUrl = `${this.publicBaseUrl}/api/attachments/download/${attachmentId}?key=${encodeURIComponent(objectKey)}&sig=${signature}`;
        }
        return {
            uploadUrl,
            downloadUrl,
            objectKey,
            expiresInSeconds,
            attachmentId,
        };
    }
    verifyUploadSignature(objectKey, mimeType, size, exp, sig) {
        if (Date.now() > exp)
            return false;
        const payload = `${objectKey}:${mimeType}:${size}:${exp}`;
        const expectedSig = crypto
            .createHmac('sha256', this.signingSecret)
            .update(payload)
            .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map