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
import { MarkDeliveredDto } from './dto/mark-delivered.dto';
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
      for (const room of userRooms) {
        this.server.to(room._id.toString()).emit('userStatus', {
          userId: client.user.userId,
          isOnline: true,
        });
      }

      // --- 4. Track active socket ---
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
        const userRooms = await this.chatService.getUserRoomsForSocket(client.user.userId);

        for (const room of userRooms) {
          this.server.to(room._id.toString()).emit('userStatus', {
            userId: client.user.userId,
            isOnline: false,
          });

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
    // Capture into a local const so TypeScript's narrowing persists inside closures.
    const user = client.user;

    try {
      console.log('🚀 Payload received from Flutter:', payload);

      const { message, isNew } = await this.chatService.saveMessage(user.userId, payload);

      // ── Always ACK the sender ────────────────────────────────────────────────
      // Emit messageSent regardless of whether the message is new or a duplicate.
      // If isNew=false the client is retrying after a dropped ACK — it still
      // needs this confirmation to promote the message from pending → sent.
      client.emit('messageSent', {
        clientMessageId: payload.clientMessageId,
        createdAt: (message as any).createdAt
      });

      // ── Only broadcast on first delivery ─────────────────────────────────────
      // Suppress newMessage for duplicates so recipients never see the same
      // message twice (idempotency contract).
      if (isNew) {
        let shouldDeliver = true;

        // ── Block Guard ────────────────────────────────────────────────────────
        const room = await this.chatService.getRoomById(payload.chatRoomId);
        if (room && room.type === 'PRIVATE') {
          const otherParticipant = (room.participants as any[]).find(
            (p) => p.toString() !== user.userId,
          );
          if (otherParticipant) {
            const isBlocked = await this.chatService.isBlocked(user.userId, otherParticipant.toString());
            if (isBlocked) {
              shouldDeliver = false;
              this.logger.log(`[Block Guard] Message from ${user.userId} dropped: Blocked by ${otherParticipant}`);
            }
          }
        }

        if (shouldDeliver) {
          client.broadcast.to(payload.chatRoomId).emit('newMessage', message);
        }
      } else {
        console.log(`⚡ Duplicate suppressed for clientMessageId: ${payload.clientMessageId}`);
      }

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
      chatRoomId: payload.roomId,
      userId: client.user.userId,
      phoneNumber: client.user.phoneNumber,
      isTyping: payload.isTyping,
    });
  }

  /**
   * Used when a client physically receives the active packet to track 2 grey ticks.
   */
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('markDelivered')
  async handleMarkDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkDeliveredDto,
  ) {
    if (!client.user) return;

    try {
      console.log('🚀 Payload received from Flutter(markDelivered):', payload);
      const idsToMark = payload.clientMessageIds ? payload.clientMessageIds : (payload.clientMessageId ? [payload.clientMessageId] : []);
      if (idsToMark.length === 0) return;

      await this.chatService.markMessagesDelivered(client.user.userId, payload.chatRoomId, idsToMark);

      // Determine sender's identity. For now broadcast locally to everyone except this user but ideate targeted soon.
      // Wait, we need to find the specific sender's socket. In a 1-on-1 chat, the "other" person is the target.
      client.broadcast.to(payload.chatRoomId).emit('messageDelivered', {
        chatRoomId: payload.chatRoomId,
        clientMessageIds: idsToMark,
        deliveredTo: client.user.userId,
      });

    } catch (e) {
      console.error('🛡️ Mark Delivered Error:', e.message);
    }
  }

  /**
   * Marks messages as read (2 blue ticks).
   */
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadDto,
  ) {
    if (!client.user) return;

    try {
      const idsToMark = payload.clientMessageIds ? payload.clientMessageIds : (payload.clientMessageId ? [payload.clientMessageId] : []);
      if (idsToMark.length === 0) return;

      await this.chatService.markMessagesRead(client.user.userId, payload.chatRoomId, idsToMark);

      client.broadcast.to(payload.chatRoomId).emit('messageRead', {
        chatRoomId: payload.chatRoomId,
        clientMessageIds: idsToMark,
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

  /**
   * FR-022: Delete a message for everyone in the room.
   * Validates that the requester is the sender and the message is < 1 hour old.
   * Sets isDeleted = true in MongoDB and broadcasts `messageDeleted` to all room sockets.
   */
  @SubscribeMessage('deleteForEveryone')
  async handleDeleteForEveryone(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { clientMessageId: string },
  ) {
    if (!client.user) return;
    const { clientMessageId } = payload;
    if (!clientMessageId) return;

    try {
      const message = await this.chatService.getMessageByClientId(clientMessageId);

      if (!message) {
        this.logger.warn(`[DELETE] Message not found: ${clientMessageId}`);
        return;
      }

      // Ownership check — only the original sender can delete for everyone.
      if (message.senderId.toString() !== client.user.userId) {
        client.emit('error', { message: 'Cannot delete: not the sender' });
        return;
      }

      // Time-limit check — must be within 1 hour of creation.
      const createdAt = (message as any).createdAt as Date;
      const ageMs = Date.now() - new Date(createdAt).getTime();
      const ONE_HOUR_MS = 60 * 60 * 1000;
      if (ageMs > ONE_HOUR_MS) {
        client.emit('error', { message: 'Cannot delete: message older than 1 hour' });
        return;
      }

      // Persist soft-delete.
      await this.chatService.softDeleteMessage(clientMessageId);

      // Broadcast to ALL room members (including sender for multi-device sync).
      const roomId = message.chatRoomId.toString();
      this.server.to(roomId).emit('messageDeleted', {
        clientMessageId,
        roomId,
        deletedBy: client.user.userId,
      });

      this.logger.log(`[DELETE] ${client.user.userId} deleted message ${clientMessageId}`);
    } catch (e) {
      this.logger.error(`[DELETE] deleteForEveryone error: ${e.message}`);
    }
  }
}
