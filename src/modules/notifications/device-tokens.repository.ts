import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DeviceToken, DeviceTokenDocument } from './device-token.schema';

@Injectable()
export class DeviceTokensRepository {
  constructor(
    @InjectModel(DeviceToken.name)
    private readonly model: Model<DeviceTokenDocument>,
  ) {}

  async upsertToken(userId: string, token: string, platform: 'fcm' | 'apns'): Promise<void> {
    await this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), token },
      { $set: { platform, userId: new Types.ObjectId(userId), token } },
      { upsert: true },
    ).exec();
  }

  async getTokens(userId: string): Promise<DeviceTokenDocument[]> {
    return this.model.find({ userId: new Types.ObjectId(userId) }).exec();
  }
}
