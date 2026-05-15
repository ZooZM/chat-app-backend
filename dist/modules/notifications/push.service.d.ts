import { OnModuleInit } from '@nestjs/common';
import { DeviceTokensRepository } from './device-tokens.repository';
export declare class PushService implements OnModuleInit {
    private readonly deviceTokensRepository;
    private readonly logger;
    constructor(deviceTokensRepository: DeviceTokensRepository);
    onModuleInit(): void;
    sendPush(deviceToken: string, payload: {
        title: string;
        body: string;
        data?: Record<string, string>;
    }): Promise<void>;
    notifyOfflineUser(userId: string, message: {
        content: string;
        senderName?: string;
        roomId: string;
    }): Promise<void>;
}
