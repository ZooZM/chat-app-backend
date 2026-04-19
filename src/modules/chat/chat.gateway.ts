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
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { UsersService } from '../users/users.service';
import { RequestCallDto } from './dto/request-call.dto';
import { AcceptCallDto } from './dto/accept-call.dto';
import { RejectCallDto } from './dto/reject-call.dto';

interface AuthenticatedSocket extends Socket {
  user?: { userId: string; phoneNumber: string };
}

@WebSocketGateway({
  cors: { origin: '*' }, // Rely on strict app config typically, simplified for WS
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeSockets = new Map<string, AuthenticatedSocket>();
  private activeCalls = new Map<string, string>(); // userId -> partnerId

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) { }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // --- 1. Authenticate the socket ---
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

      // --- 2. Auto-join ALL of the user's rooms on connect (WhatsApp-style) ---
      // Fetch all chat rooms the user is a participant in from MongoDB
      const userRooms = await this.chatService.getUserRoomsForSocket(client.user.userId);

      const roomIds = userRooms.map((room) => room._id.toString());
      if (roomIds.length > 0) {
        // Use Socket.IO's join to subscribe this socket to all room channels at once
        await client.join(roomIds);
      }

      this.logger.log(
        `[WS CONNECTED] User: ${client.user.userId} | Socket: ${client.id} | Auto-joined ${roomIds.length} room(s)`,
      );

      // --- 3. Set user online in DB ---
      await this.usersService.updateOnlineStatus(client.user.userId, true);

      // Track active socket
      this.activeSockets.set(client.user.userId, client);

      // Notify the client that connection + room-joining was successful
      client.emit('connected', {
        userId: client.user.userId,
        joinedRooms: roomIds,
      });
    } catch (error) {
      this.logger.warn(`[WS REJECTED] Socket: ${client.id} | Reason: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      if (this.activeSockets.get(client.user.userId)?.id === client.id) {
        this.activeSockets.delete(client.user.userId);
        // --- Set user offline in DB ---
        await this.usersService.updateOnlineStatus(client.user.userId, false);
      }

      // --- Terminate active call if disconnected during one ---
      const partnerId = this.activeCalls.get(client.user.userId);
      if (partnerId) {
        const partnerSocket = this.activeSockets.get(partnerId);
        if (partnerSocket) {
          partnerSocket.emit('callEnded', { reason: 'peer_disconnected' });
        }
        this.activeCalls.delete(client.user.userId);
        this.activeCalls.delete(partnerId);
      }
    }
    this.logger.log(`[WS DISCONNECTED] Socket: ${client.id} | User: ${client.user?.userId ?? 'unauthenticated'}`);
  }

  /**
   * Allows clients to manually join a specific room (e.g., after creating a new group).
   * Since rooms are auto-joined on connection, this is mainly needed for newly created rooms.
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody('roomId') roomId: string,
  ) {
    if (!client.user) return;
    await client.join(roomId);
    this.logger.log(`User ${client.user.userId} manually joined room ${roomId}`);
    return { event: 'joinedRoom', data: roomId };
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessageDto,
  ) {
    if (!client.user) return;

    try {
      console.log('🚀 Payload received from Flutter:', payload);

      const savedMessage = await this.chatService.saveMessage(client.user.userId, payload);

      client.emit('messageDelivered', { messageId: payload.messageId });


      client.broadcast.to(payload.chatRoomId).emit('newMessage', savedMessage);

    } catch (e) {
      console.error('Send Message Error:', e.message);
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; isTyping: boolean },
  ) {
    if (!client.user) return;
    // Broadcast to everyone in the room EXCEPT the sender
    client.to(payload.roomId).emit('userTyping', {
      userId: client.user.userId,
      phoneNumber: client.user.phoneNumber,
      isTyping: payload.isTyping,
    });
  }

  /**
   * Marks messages as read for this user and broadcasts the read receipts
   * to the room so all group members can update their UI.
   */
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadDto,
  ) {
    if (!client.user) return;

    try {
      const idsToMark = payload.messageIds ? payload.messageIds : (payload.messageId ? [payload.messageId] : []);
      console.log('🚀 Payload received from Flutter:', payload);
      if (idsToMark.length === 0) return;

      await this.chatService.markMessagesRead(client.user.userId, payload.chatRoomId, idsToMark);
      client.broadcast.to(payload.chatRoomId).emit('messagesRead', {
        chatRoomId: payload.chatRoomId,
        messageIds: idsToMark,
        readBy: client.user.userId,
      });

    } catch (e) {
      console.error('🛡️ Mark Read Error:', e.message);
    }
  }

  // --- Call Signaling Events ---

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('requestCall')
  async handleRequestCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RequestCallDto,
  ) {
    if (!client.user) return;

    try {
      const caller = await this.usersService.findById(client.user.userId);
      if (!caller) throw new Error('Caller not found');
      const targetUser = await this.usersService.findByPhoneNumber(payload.targetUserId);

      if (!targetUser) {
        client.emit('callError', { reason: 'user_not_found' });
        return;
      }

      const targetSocket = this.activeSockets.get(targetUser._id.toString());
      if (targetSocket) {
        // Target is online
        targetSocket.emit('incomingCall', {
          callerId: client.user.phoneNumber,
          callerName: caller.name,
          callerAvatar: '', // Set when user schema has an avatar
          isVideo: payload.isVideo,
        });
        this.logger.log(`[Call] Call requested from ${client.user.userId} to ${payload.targetUserId}`);
      } else {
        // Target is offline
        client.emit('callError', { reason: 'target_offline' });
        this.logger.log(`[Call] Call requested from ${client.user.userId} to ${payload.targetUserId} but target is offline`);
      }
    } catch (e) {
      this.logger.warn(`[Call] requestCall error: ${e.message}`);
    }
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('acceptCall')
  async handleAcceptCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: AcceptCallDto,
  ) {
    if (!client.user) return;

    // payload.callerId from frontend is currently the phone number due to incomingCall payload structure
    const callerUser = await this.usersService.findByPhoneNumber(payload.callerId);
    if (!callerUser) {
      client.emit('callError', { reason: 'caller_not_found' });
      return;
    }

    const callerDbId = callerUser._id.toString();
    const receiverDbId = client.user.userId;

    // Establish active call link (bidirectional)
    this.activeCalls.set(callerDbId, receiverDbId);
    this.activeCalls.set(receiverDbId, callerDbId);

    const callerSocket = this.activeSockets.get(callerDbId);

    // Generate a unique room name for the call
    const roomName = `call_${callerDbId}_${receiverDbId}`;
    const livekitUrl = this.configService.get<string>('LIVEKIT_WS_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    // Create token for caller
    const callerToken = new AccessToken(apiKey, apiSecret, {
      identity: callerDbId,
    });
    callerToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    // Create token for receiver (the one who accepted)
    const receiverToken = new AccessToken(apiKey, apiSecret, {
      identity: receiverDbId,
    });
    receiverToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    if (callerSocket) {
      // Notify caller
      callerSocket.emit('callAccepted', {
        receiverId: receiverDbId,
        roomName,
        livekitUrl,
        livekitToken: await callerToken.toJwt(),
      });
    }

    // Notify receiver
    client.emit('callAccepted', {
      callerId: payload.callerId, // return the original callerId passed
      roomName,
      livekitUrl,
      livekitToken: await receiverToken.toJwt(),
    });

    this.logger.log(`[Call] User ${receiverDbId} accepted call from ${callerDbId}. Room: ${roomName}`);
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('rejectCall')
  async handleRejectCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RejectCallDto,
  ) {
    if (!client.user) return;

    const callerUser = await this.usersService.findByPhoneNumber(payload.callerId);
    if (!callerUser) return;

    const callerSocket = this.activeSockets.get(callerUser._id.toString());
    if (callerSocket) {
      // Notify caller
      callerSocket.emit('callRejected', { receiverId: client.user.userId });
    }
    this.logger.log(`[Call] User ${client.user.userId} rejected call from ${callerUser._id.toString()}`);
  }

  @SubscribeMessage('endCall')
  async handleEndCall(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) return;

    const userId = client.user.userId;
    const partnerId = this.activeCalls.get(userId);

    if (partnerId) {
      const partnerSocket = this.activeSockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('callEnded', { reason: 'user_ended' });
      }

      // Clean up map
      this.activeCalls.delete(userId);
      this.activeCalls.delete(partnerId);

      this.logger.log(`[Call] Call ended between ${userId} and ${partnerId}`);
    }
  }
}
