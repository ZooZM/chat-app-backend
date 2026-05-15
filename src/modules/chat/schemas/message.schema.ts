import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageType {
  TEXT       = 'text',
  IMAGE      = 'image',
  FILE       = 'file',
  CONTACT    = 'contact',
  VOICE_NOTE = 'voice_note',
  SYSTEM     = 'system',
  LOCATION   = 'location',
  AUDIO      = 'audio',
  POLL       = 'poll',
  EVENT      = 'event',
  VIDEO      = 'video',
}

export enum MessageStatus {
  PENDING   = 'pending',
  SENT      = 'sent',
  DELIVERED = 'delivered',
  READ      = 'read',
}

/**
 * Flexible metadata bag stored as a sub-document.
 *   Images / Files:  { fileName, fileSize, mimeType }
 *   Contacts:        { contactName, contactPhone, contactEmail? }
 *   Voice notes:     { duration } (seconds)
 *   Location:        { latitude, longitude, address? }
 *   Audio:           { duration, mimeType, fileName }
 *   Poll:            { question, options, votes? }
 *   Event:           { title, dateTime, description? }
 */
export class MessageMetadata {
  fileName?:     string;
  fileSize?:     number;
  mimeType?:     string;
  duration?:     number;
  contactName?:  string;
  contactPhone?: string;
  contactEmail?: string;
  latitude?:     number;
  longitude?:    number;
  address?:      string;
  question?:     string;
  options?:      string[];
  votes?:        Record<string, string[]>;
  title?:        string;
  dateTime?:     string;
  description?:  string;
  thumbnailUrl?: string;
}

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'ChatRoom', required: true, index: true })
  chatRoomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  /** Text body. Empty string is valid for pure file/image messages (no caption). */
  @Prop({ type: String, default: '' })
  content: string;

  @Prop({ type: String, required: false })
  clientMessageId: string;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT,
  })
  messageType: MessageType;

  /** Relative URL returned by POST /chat/upload, e.g. /uploads/abc.jpg */
  @Prop({ type: String, required: false })
  fileUrl?: string;

  /** Flexible metadata: fileName/fileSize for files, contactName/phone for contacts, etc. */
  @Prop({ type: Object, required: false })
  metadata?: MessageMetadata;

  @Prop({ type: String, enum: Object.values(MessageStatus), default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({ type: [String], default: [] })
  deliveredTo: string[];

  @Prop({ type: [String], default: [] })
  readBy: string[];

  /** FR-022: Soft-delete. When true the content is hidden from all clients. */
  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  /** FR-027: Waveform samples pre-extracted at record time to avoid receiver re-extraction. */
  @Prop({ type: [Number], default: [] })
  waveformSamples: number[];
}
export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index for efficient room message pagination queries
MessageSchema.index({ chatRoomId: 1, _id: -1 });
