"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@nestjs/config");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    adapterConstructor;
    constructor(app) {
        super(app);
        const configService = app.get(config_1.ConfigService);
        const redisUrl = configService.get('REDIS_URL') || 'redis://localhost:6379';
        const pubClient = new ioredis_1.default(redisUrl);
        const subClient = pubClient.duplicate();
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map