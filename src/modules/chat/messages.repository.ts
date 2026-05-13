import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { Message, MessageDocument, MessageStatus } from './schemas/message.schema';

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

  async markDelivered(messageIds: string[], phoneNumber: string): Promise<void> {
    await this.messageModel.updateMany({ clientMessageId: { $in: messageIds } }, {
      $addToSet: { deliveredTo: phoneNumber },
      $set: { status: MessageStatus.DELIVERED },
    }).exec();
  }

  /**
   * Idempotently marks messages as read by a given phoneNumber.
   * Uses $addToSet so repeated calls for the same user are a no-op.
   */
  async markRead(messageIds: string[], phoneNumber: string): Promise<void> {
    await this.messageModel.updateMany(
      { clientMessageId: { $in: messageIds } },
      { 
        $addToSet: { readBy: phoneNumber, deliveredTo: phoneNumber },
        $set: { status: MessageStatus.READ },
      },
    ).exec();
  }

  /**
   * Finds a single message document by its client-generated UUID.
   * Used by ChatService.saveMessage() to enforce idempotency on duplicate sends.
   */
  async findByClientMessageId(clientMessageId: string): Promise<MessageDocument | null> {
    return this.findOne({ clientMessageId });
  }

  async fetchStatusesByClientIds(clientMessageIds: string[]): Promise<{ clientMessageId: string; status: MessageStatus }[]> {
    return this.messageModel
        .find({ clientMessageId: { $in: clientMessageIds } })
        .select('clientMessageId status')
        .lean()
        .exec() as unknown as { clientMessageId: string; status: MessageStatus }[];
  }

  async softDelete(
    clientMessageId: string,
    requesterId: string,
    windowMinutes: number,
  ): Promise<MessageDocument | null> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.messageModel.findOneAndUpdate(
      {
        clientMessageId,
        senderId: new Types.ObjectId(requesterId),
        createdAt: { $gte: cutoff },
        isDeleted: false,
      },
      { $set: { isDeleted: true, content: '' } },
      { new: true },
    ).exec();
  }
}
