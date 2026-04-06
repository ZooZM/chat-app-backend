import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class Subscription {
  @Prop({ type: String, enum: SubscriptionTier, default: SubscriptionTier.FREE })
  tier: string;

  @Prop({ type: String, enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: string;

  @Prop({ type: Number, default: 0 })
  translationMinutesBalance: number;

  @Prop({ type: Date, required: false })
  expiresAt?: Date;

  @Prop({ type: String, required: false })
  paymentCustomerId?: string;
}

@Schema({ _id: false })
export class Location {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: string;

  @Prop({ type: [Number], required: false })
  coordinates: number[]; // [longitude, latitude]
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  phoneNumber: string;

  @Prop({ required: false }) // fallback
  email?: string;

  @Prop({ required: false }) // fallback
  password?: string;

  @Prop({ default: false })
  isPhoneVerified: boolean;

  @Prop({ required: false })
  fcmToken?: string;

  @Prop({ required: false })
  refreshToken?: string;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ type: Location, index: '2dsphere', required: false })
  location?: Location;

  @Prop({ type: Subscription, default: () => ({}) })
  subscription: Subscription;
}

export const UserSchema = SchemaFactory.createForClass(User);
