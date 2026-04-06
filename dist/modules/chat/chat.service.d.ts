import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
export declare class ChatService {
    private chatRoomModel;
    private messageModel;
    constructor(chatRoomModel: Model<ChatRoomDocument>, messageModel: Model<MessageDocument>);
    createPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument>;
    saveMessage(senderId: string, payload: SendMessageDto): Promise<MessageDocument>;
    getUserRooms(userId: string, limit?: number, cursor?: string): Promise<(import("mongoose").Document<unknown, {}, ChatRoomDocument, {}, import("mongoose").DefaultSchemaOptions> & ChatRoom & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getRoomMessages(roomId: string, limit?: number, cursor?: string): Promise<(import("mongoose").Document<unknown, {}, MessageDocument, {}, import("mongoose").DefaultSchemaOptions> & Message & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
