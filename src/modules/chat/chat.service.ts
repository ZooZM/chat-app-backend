import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { Message, MessageDocument, MessageStatus } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument> {
    const participants = [new Types.ObjectId(userA), new Types.ObjectId(userB)];
    const existing = await this.chatRoomModel.findOne({
      type: 'PRIVATE',
      participants: { $all: participants, $size: 2 },
    });
    if (existing) return existing;

    const newRoom = new this.chatRoomModel({ type: 'PRIVATE', participants });
    return newRoom.save();
  }

  async saveMessage(senderId: string, payload: SendMessageDto): Promise<MessageDocument> {
    const room = await this.chatRoomModel.findById(payload.chatRoomId);
    if (!room) throw new NotFoundException('Chat room not found');

    const message = new this.messageModel({
      chatRoomId: new Types.ObjectId(payload.chatRoomId),
      senderId: new Types.ObjectId(senderId),
      content: payload.content,
      status: MessageStatus.SENT,
    });

    const savedMessage = await message.save();

    room.lastMessage = savedMessage._id as Types.ObjectId;
    await room.save();

    return savedMessage;
  }

  async getUserRooms(userId: string, limit = 20, cursor?: string) {
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

  async getRoomMessages(roomId: string, limit = 50, cursor?: string) {
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
