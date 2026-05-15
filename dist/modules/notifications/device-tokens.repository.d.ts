import { Model } from 'mongoose';
import { DeviceTokenDocument } from './device-token.schema';
export declare class DeviceTokensRepository {
    private readonly model;
    constructor(model: Model<DeviceTokenDocument>);
    upsertToken(userId: string, token: string, platform: 'fcm' | 'apns'): Promise<void>;
    getTokens(userId: string): Promise<DeviceTokenDocument[]>;
    deleteAllTokensForUser(userId: string): Promise<void>;
}
