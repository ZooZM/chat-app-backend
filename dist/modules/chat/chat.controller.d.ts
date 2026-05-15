import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateGroupDto, AddParticipantsDto, RemoveParticipantDto } from './dto/group.dto';
import { ResolvePrivateChatDto } from './dto/resolve-private-chat.dto';
export declare class ChatController {
    private readonly chatService;
    private readonly chatGateway;
    constructor(chatService: ChatService, chatGateway: ChatGateway);
    getUserRooms(req: any, limit?: number, cursor?: string): Promise<import("./schemas/chat-room.schema").ChatRoomDocument[]>;
    getRoomMessages(roomId: string, limit?: number, cursor?: string): Promise<import("./schemas/message.schema").MessageDocument[]>;
    resolvePrivateChat(req: any, dto: ResolvePrivateChatDto): Promise<{
        roomId: string;
        room: import("./schemas/chat-room.schema").ChatRoomDocument;
    }>;
    syncStatuses(dto: {
        clientMessageIds: string[];
    }): Promise<{
        clientMessageId: string;
        status: import("./schemas/message.schema").MessageStatus;
    }[]>;
    uploadFile(file: Express.Multer.File): Promise<{
        fileUrl: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
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
        newAdmin: string | null;
    }>;
    updateGroup(req: any, roomId: string, dto: {
        name?: string;
        avatarUrl?: string;
    }): Promise<import("./schemas/chat-room.schema").ChatRoomDocument>;
}
