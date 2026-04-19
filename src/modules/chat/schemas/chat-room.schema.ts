import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ChatRoomType {
  PRIVATE = 'PRIVATE',
  GROUP = 'GROUP',
}

export type ChatRoomDocument = ChatRoom & Document;

@Schema({ timestamps: true })
export class ChatRoom {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: String, enum: ChatRoomType, default: ChatRoomType.PRIVATE })
  type: ChatRoomType;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: false })
  lastMessage?: Types.ObjectId;

  /**
   * Human-readable name of the room. Mandatory for GROUP, unused for PRIVATE.
   */
  @Prop({ type: String, required: false, trim: true })
  name?: string;

  /**
   * URL for the group's avatar image. Optional, only relevant for GROUP type.
   */
  @Prop({ type: String, required: false })
  avatarUrl?: string;

  /**
   * Phone numbers of participants who have admin privileges.
   * The creator of a group is auto-added as the first admin.
   */
  @Prop({ type: [String], default: [] })
  admins: string[];
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

// Index to efficiently find all rooms for a given participant
ChatRoomSchema.index({ participants: 1, updatedAt: -1 });
