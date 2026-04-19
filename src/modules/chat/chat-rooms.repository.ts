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

  /**
   * Returns only the _id of every room a user belongs to.
   * Used by ChatGateway on connect to auto-join socket.io rooms efficiently.
   */
  async getUserRoomIds(userId: string): Promise<{ _id: any }[]> {
    return this.chatRoomModel
      .find({ participants: new Types.ObjectId(userId) })
      .select('_id')
      .lean()
      .exec();
  }

  /**
   * Adds participant ObjectIds to the room using $addToSet (idempotent).
   */
  async addParticipants(roomId: string, userIds: Types.ObjectId[]): Promise<ChatRoomDocument | null> {
    return this.chatRoomModel.findByIdAndUpdate(
      roomId,
      { $addToSet: { participants: { $each: userIds } } },
      { new: true },
    ).exec();
  }

  /**
   * Removes a single participant ObjectId from the room.
   */
  async removeParticipant(roomId: string, userId: Types.ObjectId): Promise<ChatRoomDocument | null> {
    return this.chatRoomModel.findByIdAndUpdate(
      roomId,
      { $pull: { participants: userId } },
      { new: true },
    ).exec();
  }

  /**
   * Removes a phone number from the admins array of a group.
   */
  async removeAdmin(roomId: string, phoneNumber: string): Promise<ChatRoomDocument | null> {
    return this.chatRoomModel.findByIdAndUpdate(
      roomId,
      { $pull: { admins: phoneNumber } },
      { new: true },
    ).exec();
  }

  /**
   * Promotes a phone number to admin.
   */
  async addAdmin(roomId: string, phoneNumber: string): Promise<ChatRoomDocument | null> {
    return this.chatRoomModel.findByIdAndUpdate(
      roomId,
      { $addToSet: { admins: phoneNumber } },
      { new: true },
    ).exec();
  }
}
