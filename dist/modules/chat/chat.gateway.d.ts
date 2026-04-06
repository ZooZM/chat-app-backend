import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
interface AuthenticatedSocket extends Socket {
    user?: {
        userId: string;
        phoneNumber: string;
    };
}
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    private chatService;
    server: Server;
    constructor(jwtService: JwtService, chatService: ChatService);
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): void;
    handleJoinRoom(client: AuthenticatedSocket, roomId: string): Promise<{
        event: string;
        data: string;
    } | undefined>;
    handleSendMessage(client: AuthenticatedSocket, payload: SendMessageDto): Promise<{
        event: string;
        data: any;
    } | undefined>;
    handleTyping(client: AuthenticatedSocket, payload: {
        roomId: string;
        isTyping: boolean;
    }): void;
}
export {};
