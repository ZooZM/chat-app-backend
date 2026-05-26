import { OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
export declare class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
    private readonly redis;
    constructor(redisUrl: string);
    increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<{
        totalHits: number;
        timeToExpire: number;
        isBlocked: boolean;
        timeToBlockExpire: number;
    }>;
    onApplicationShutdown(): Promise<void>;
}
