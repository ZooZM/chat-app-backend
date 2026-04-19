import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { ChatRoomDocument } from './schemas/chat-room.schema';
export declare class ChatRoomsRepository extends BaseRepository<ChatRoomDocument> {
    private readonly chatRoomModel;
    constructor(chatRoomModel: Model<ChatRoomDocument>);
    findPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument | null>;
    getUserRooms(userId: string, limit: number, cursor?: string): Promise<ChatRoomDocument[]>;
    updateLastMessage(roomId: string, messageId: string): Promise<void>;
    findById(roomId: string): Promise<ChatRoomDocument | null>;
    getUserRoomIds(userId: string): Promise<{
        _id: any;
    }[]>;
    addParticipants(roomId: string, userIds: Types.ObjectId[]): Promise<ChatRoomDocument | null>;
    removeParticipant(roomId: string, userId: Types.ObjectId): Promise<ChatRoomDocument | null>;
    removeAdmin(roomId: string, phoneNumber: string): Promise<ChatRoomDocument | null>;
    addAdmin(roomId: string, phoneNumber: string): Promise<ChatRoomDocument | null>;
}
