import { ChatService } from './chat.service';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    getUserRooms(req: any, limit?: number, cursor?: string): Promise<import("./schemas/chat-room.schema").ChatRoomDocument[]>;
    getRoomMessages(roomId: string, limit?: number, cursor?: string): Promise<import("./schemas/message.schema").MessageDocument[]>;
}
