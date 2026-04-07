import { Model } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { ChatRoomDocument } from './schemas/chat-room.schema';
export declare class ChatRoomsRepository extends BaseRepository<ChatRoomDocument> {
    private readonly chatRoomModel;
    constructor(chatRoomModel: Model<ChatRoomDocument>);
    findPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument | null>;
    getUserRooms(userId: string, limit: number, cursor?: string): Promise<ChatRoomDocument[]>;
    updateLastMessage(roomId: string, messageId: string): Promise<void>;
    findById(roomId: string): Promise<ChatRoomDocument | null>;
}
