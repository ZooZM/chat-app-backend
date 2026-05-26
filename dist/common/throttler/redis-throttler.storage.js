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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisThrottlerStorage = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisThrottlerStorage = class RedisThrottlerStorage {
    redis;
    constructor(redisUrl) {
        this.redis = new ioredis_1.default(redisUrl);
    }
    async increment(key, ttl, limit, blockDuration, throttlerName) {
        const counterKey = `throttle:${throttlerName}:${key}`;
        const blockKey = `throttle:${throttlerName}:${key}:block`;
        const blockTtlMs = await this.redis.pttl(blockKey);
        if (blockTtlMs > 0) {
            const blockSeconds = Math.ceil(blockTtlMs / 1000);
            return {
                totalHits: limit + 1,
                timeToExpire: blockSeconds,
                isBlocked: true,
                timeToBlockExpire: blockSeconds,
            };
        }
        const totalHits = await this.redis.incr(counterKey);
        if (totalHits === 1) {
            await this.redis.pexpire(counterKey, ttl);
        }
        const ttlRemainingMs = await this.redis.pttl(counterKey);
        const timeToExpire = Math.ceil((ttlRemainingMs > 0 ? ttlRemainingMs : ttl) / 1000);
        if (totalHits > limit) {
            await this.redis.set(blockKey, '1', 'PX', blockDuration);
            return {
                totalHits,
                timeToExpire,
                isBlocked: true,
                timeToBlockExpire: Math.ceil(blockDuration / 1000),
            };
        }
        return {
            totalHits,
            timeToExpire,
            isBlocked: false,
            timeToBlockExpire: 0,
        };
    }
    async onApplicationShutdown() {
        await this.redis.quit();
    }
};
exports.RedisThrottlerStorage = RedisThrottlerStorage;
exports.RedisThrottlerStorage = RedisThrottlerStorage = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [String])
], RedisThrottlerStorage);
//# sourceMappingURL=redis-throttler.storage.js.map