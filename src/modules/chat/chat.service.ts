import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { Message, MessageDocument, MessageStatus } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatRoomsRepository } from './chat-rooms.repository';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRoomsRepository: ChatRoomsRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async createPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument> {
    const existing = await this.chatRoomsRepository.findPrivateRoom(userA, userB);
    if (existing) return existing;

    const participants = [new Types.ObjectId(userA), new Types.ObjectId(userB)];
    return this.chatRoomsRepository.create({ type: 'PRIVATE', participants });
  }

  async saveMessage(senderId: string, payload: SendMessageDto): Promise<MessageDocument> {
    const room = await this.chatRoomsRepository.findById(payload.chatRoomId);
    if (!room) throw new NotFoundException('Chat room not found');

    const savedMessage = await this.messagesRepository.create({
      chatRoomId: new Types.ObjectId(payload.chatRoomId),
      senderId: new Types.ObjectId(senderId),
      content: payload.content,
      status: MessageStatus.SENT,
    });

    await this.chatRoomsRepository.updateLastMessage(payload.chatRoomId, savedMessage._id.toString());

    return savedMessage;
  }

  async getUserRooms(userId: string, limit = 20, cursor?: string) {
    return this.chatRoomsRepository.getUserRooms(userId, limit, cursor);
  }

  async getRoomMessages(roomId: string, limit = 50, cursor?: string) {
    return this.messagesRepository.getRoomMessages(roomId, limit, cursor);
  }
}
