import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends Socket {
  user?: { userId: string; phoneNumber: string };
}

@WebSocketGateway({
  cors: { origin: '*' }, // Rely on strict app config typically, simplified for WS
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      const queryToken = client.handshake.query.token as string;
      const authObjectToken = client.handshake.auth?.token;
      
      let token = queryToken || authObjectToken;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }

      if (!token) throw new Error('Missing token');

      const payload = await this.jwtService.verifyAsync(token);
      client.user = { userId: payload.sub, phoneNumber: payload.phoneNumber };
      
      console.log(`[WS CONNECTED] Client: ${client.id}, User: ${client.user.userId}`);
    } catch (error) {
      console.log(`[WS REJECTED] Client: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    console.log(`[WS DISCONNECTED] Client: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody('roomId') roomId: string,
  ) {
    if (!client.user) return;
    client.join(roomId);
    console.log(`User ${client.user.userId} joined room ${roomId}`);
    return { event: 'joinedRoom', data: roomId };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessageDto,
  ) {
    if (!client.user) return;

    try {
      const savedMessage = await this.chatService.saveMessage(client.user.userId, payload);
      
      this.server.to(payload.chatRoomId).emit('newMessage', savedMessage);
      
      return { event: 'messageSent', data: savedMessage._id };
    } catch (e) {
      return { event: 'error', data: e.message };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; isTyping: boolean },
  ) {
    if (!client.user) return;
    client.to(payload.roomId).emit('userTyping', {
      userId: client.user.userId,
      isTyping: payload.isTyping,
    });
  }
}
