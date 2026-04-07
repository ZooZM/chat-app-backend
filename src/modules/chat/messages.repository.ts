import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class MessagesRepository extends BaseRepository<MessageDocument> {
  constructor(@InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>) {
    super(messageModel);
  }

  async getRoomMessages(roomId: string, limit: number, cursor?: string): Promise<MessageDocument[]> {
    const query: any = { chatRoomId: new Types.ObjectId(roomId) };
    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    return this.messageModel
      .find(query)
      .sort({ createdAt: -1 }) // Return newest first for standard chat scroll
      .limit(limit)
      .populate('senderId', 'name phoneNumber')
      .exec();
  }
}
