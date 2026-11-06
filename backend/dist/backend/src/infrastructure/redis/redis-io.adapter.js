"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const common_1 = require("@nestjs/common");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    redisService;
    adapterConstructor = null;
    ioLogger = new common_1.Logger(RedisIoAdapter.name);
    constructor(app, redisService) {
        super(app);
        this.redisService = redisService;
        const pub = this.redisService.getPubClient();
        const sub = this.redisService.getSubClient();
        if (pub && sub && this.redisService.isRedisConnected()) {
            this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pub, sub);
            this.ioLogger.log('Socket.IO Redis adapter enabled for multi-instance broadcast scaling.');
        }
        else {
            this.ioLogger.warn('Socket.IO running in single-instance memory adapter mode (Redis not connected).');
        }
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            transports: ['websocket', 'polling'],
            allowEIO3: true,
            pingTimeout: 20000,
            pingInterval: 10000,
        });
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map