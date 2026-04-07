import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';

@Injectable()
export class ChatRoomsRepository extends BaseRepository<ChatRoomDocument> {
  constructor(@InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoomDocument>) {
    super(chatRoomModel);
  }

  async findPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument | null> {
    const participants = [new Types.ObjectId(userA), new Types.ObjectId(userB)];
    return this.chatRoomModel.findOne({
      type: 'PRIVATE',
      participants: { $all: participants, $size: 2 },
    }).exec();
  }

  async getUserRooms(userId: string, limit: number, cursor?: string): Promise<ChatRoomDocument[]> {
    const query: any = { participants: new Types.ObjectId(userId) };
    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    return this.chatRoomModel
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('lastMessage')
      .populate('participants', 'name phoneNumber')
      .exec();
  }

  async updateLastMessage(roomId: string, messageId: string): Promise<void> {
    await this.chatRoomModel.updateOne(
      { _id: new Types.ObjectId(roomId) },
      { lastMessage: new Types.ObjectId(messageId) }
    ).exec();
  }

  async findById(roomId: string): Promise<ChatRoomDocument | null> {
    return this.chatRoomModel.findById(roomId).exec();
  }
}
