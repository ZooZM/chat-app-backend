import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MarkDeliveredDto } from './dto/mark-delivered.dto';
import { UsersService } from '../users/users.service';
import { RequestCallDto } from './dto/request-call.dto';
import { AcceptCallDto } from './dto/accept-call.dto';
import { RejectCallDto } from './dto/reject-call.dto';
import { MessagesRepository } from './messages.repository';
import { PushService } from '../notifications/push.service';
import { ChatRoomsRepository } from './chat-rooms.repository';
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
    private messagesRepository;
    private pushService;
    private chatRoomsRepository;
    server: Server;
    private activeSockets;
    private activeCalls;
    private activeGroupCalls;
    private userRoomIds;
    private readonly logger;
    constructor(jwtService: JwtService, chatService: ChatService, usersService: UsersService, configService: ConfigService, messagesRepository: MessagesRepository, pushService: PushService, chatRoomsRepository: ChatRoomsRepository);
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
    handleMarkDelivered(client: AuthenticatedSocket, payload: MarkDeliveredDto): Promise<void>;
    handleMarkRead(client: AuthenticatedSocket, payload: MarkReadDto): Promise<void>;
    handleDeleteForEveryone(client: AuthenticatedSocket, payload: {
        clientMessageId: string;
        chatRoomId: string;
    }): Promise<void>;
    handleRequestCall(client: AuthenticatedSocket, payload: RequestCallDto): Promise<void>;
    handleAcceptCall(client: AuthenticatedSocket, payload: AcceptCallDto): Promise<void>;
    handleRejectCall(client: AuthenticatedSocket, payload: RejectCallDto): Promise<void>;
    handleEndCall(client: AuthenticatedSocket): Promise<void>;
    handleRequestGroupCall(client: AuthenticatedSocket, payload: {
        chatRoomId: string;
        isVideo: boolean;
    }): Promise<void>;
    handleAcceptGroupCall(client: AuthenticatedSocket, payload: {
        chatRoomId: string;
    }): Promise<void>;
    handleDeclineGroupCall(client: AuthenticatedSocket, payload: {
        chatRoomId: string;
    }): void;
    handleLeaveGroupCall(client: AuthenticatedSocket, payload: {
        chatRoomId: string;
    }): void;
    handleGroupCallRecordingStateChanged(client: AuthenticatedSocket, payload: {
        chatRoomId: string;
        isRecording: boolean;
    }): void;
    private _handleGroupCallLeave;
    broadcastRoomUpdated(roomId: string, data: Record<string, unknown>): void;
    broadcastNewChatRoom(userIds: string[], roomId: string, data: Record<string, unknown>): Promise<void>;
}
export {};
