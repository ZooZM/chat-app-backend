import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { UsersService } from '../users/users.service';
import { RequestCallDto } from './dto/request-call.dto';
import { AcceptCallDto } from './dto/accept-call.dto';
import { RejectCallDto } from './dto/reject-call.dto';
interface AuthenticatedSocket extends Socket {
    user?: {
        userId: string;
        phoneNumber: string;
    };
}
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    private chatService;
    private usersService;
    private configService;
    server: Server;
    private activeSockets;
    private activeCalls;
    private readonly logger;
    constructor(jwtService: JwtService, chatService: ChatService, usersService: UsersService, configService: ConfigService);
    handleConnection(client: AuthenticatedSocket): Promise<void>;
    handleDisconnect(client: AuthenticatedSocket): Promise<void>;
    handleJoinRoom(client: AuthenticatedSocket, roomId: string): Promise<{
        event: string;
        data: string;
    } | undefined>;
    handleSendMessage(client: AuthenticatedSocket, payload: SendMessageDto): Promise<void>;
    handleTyping(client: AuthenticatedSocket, payload: {
        roomId: string;
        isTyping: boolean;
    }): void;
    handleMarkRead(client: AuthenticatedSocket, payload: MarkReadDto): Promise<void>;
    handleRequestCall(client: AuthenticatedSocket, payload: RequestCallDto): Promise<void>;
    handleAcceptCall(client: AuthenticatedSocket, payload: AcceptCallDto): Promise<void>;
    handleRejectCall(client: AuthenticatedSocket, payload: RejectCallDto): Promise<void>;
    handleEndCall(client: AuthenticatedSocket): Promise<void>;
}
export {};
