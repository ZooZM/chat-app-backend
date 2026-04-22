import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM', // e.g. "User X added User Y"
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'ChatRoom', required: true, index: true })
  chatRoomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: String, required: false })
  clientMessageId: string;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  messageType: MessageType;

  @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  /**
   * Phone numbers of participants who have received the message.
   * Replaces the old simple `status` enum to support group delivery tracking.
   */
  @Prop({ type: [String], default: [] })
  deliveredTo: string[];

  /**
   * Phone numbers of participants who have opened/read the message.
   */
  @Prop({ type: [String], default: [] })
  readBy: string[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index for efficient room message pagination queries
MessageSchema.index({ chatRoomId: 1, _id: -1 });
