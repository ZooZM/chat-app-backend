import { ChatService } from './chat.service';
import { CreateGroupDto, AddParticipantsDto, RemoveParticipantDto } from './dto/group.dto';
import { ResolvePrivateChatDto } from './dto/resolve-private-chat.dto';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    getUserRooms(req: any, limit?: number, cursor?: string): Promise<import("./schemas/chat-room.schema").ChatRoomDocument[]>;
    getRoomMessages(roomId: string, limit?: number, cursor?: string): Promise<import("./schemas/message.schema").MessageDocument[]>;
    resolvePrivateChat(req: any, dto: ResolvePrivateChatDto): Promise<{
        roomId: string;
        room: import("./schemas/chat-room.schema").ChatRoomDocument;
    }>;
    createGroup(req: any, dto: CreateGroupDto): Promise<{
        message: string;
        data: import("./schemas/chat-room.schema").ChatRoomDocument;
    }>;
    addParticipants(req: any, roomId: string, dto: AddParticipantsDto): Promise<{
        message: string;
        data: import("./schemas/chat-room.schema").ChatRoomDocument;
    }>;
    removeParticipant(req: any, roomId: string, dto: RemoveParticipantDto): Promise<{
        message: string;
        data: import("./schemas/chat-room.schema").ChatRoomDocument;
    }>;
    leaveGroup(req: any, roomId: string): Promise<{
        message: string;
    }>;
}
