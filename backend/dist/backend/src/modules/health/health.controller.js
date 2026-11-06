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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../infrastructure/database/database.service");
const redis_service_1 = require("../../infrastructure/redis/redis.service");
const os = require("os");
let HealthController = class HealthController {
    dbService;
    redisService;
    constructor(dbService, redisService) {
        this.dbService = dbService;
        this.redisService = redisService;
    }
    getHealth() {
        const mem = process.memoryUsage();
        return {
            status: 'healthy',
            service: 'orqland-chat-backend',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                cpuCount: os.cpus().length,
                freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
                totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
            },
            process: {
                rssMB: Math.round(mem.rss / (1024 * 1024)),
                heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
                heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
            },
            database: {
                connected: this.dbService.isDbConnected(),
            },
            redis: {
                connected: this.redisService.isRedisConnected(),
            },
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getHealth", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        redis_service_1.RedisService])
], HealthController);
//# sourceMappingURL=health.controller.js.map