import { ChatRoomDocument } from './schemas/chat-room.schema';
import { MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatRoomsRepository } from './chat-rooms.repository';
import { MessagesRepository } from './messages.repository';
export declare class ChatService {
    private readonly chatRoomsRepository;
    private readonly messagesRepository;
    constructor(chatRoomsRepository: ChatRoomsRepository, messagesRepository: MessagesRepository);
    createPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument>;
    saveMessage(senderId: string, payload: SendMessageDto): Promise<MessageDocument>;
    getUserRooms(userId: string, limit?: number, cursor?: string): Promise<ChatRoomDocument[]>;
    getRoomMessages(roomId: string, limit?: number, cursor?: string): Promise<MessageDocument[]>;
}
