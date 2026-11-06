"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const redis_io_adapter_1 = require("./infrastructure/redis/redis-io.adapter");
const redis_service_1 = require("./infrastructure/redis/redis.service");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        cors: {
            origin: [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                process.env.FRONTEND_URL || 'http://localhost:3000',
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
        },
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter());
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    const redisService = app.get(redis_service_1.RedisService);
    const redisIoAdapter = new redis_io_adapter_1.RedisIoAdapter(app, redisService);
    app.useWebSocketAdapter(redisIoAdapter);
    const port = process.env.PORT || 3001;
    await app.listen(port);
    logger.log(`🚀 ORQLAND Chat Backend running on http://localhost:${port}/api/v1`);
    logger.log(`⚡ WebSocket Gateway active on ws://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map