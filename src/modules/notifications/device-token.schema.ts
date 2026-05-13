import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DeviceTokenDocument = DeviceToken & Document;

@Schema({ timestamps: true })
export class DeviceToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  token: string;

  @Prop({ required: true, enum: ['fcm', 'apns'] })
  platform: 'fcm' | 'apns';
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

DeviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
