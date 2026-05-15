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
import { MessagesRepository } from './messages.repository';
import { CHAT_CONFIG } from './chat.config';
import { PushService } from '../notifications/push.service';
import { ChatRoomsRepository } from './chat-rooms.repository';

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
  private activeCalls = new Map<string, string>(); // userId -> partnerId (1-on-1 calls)
  private activeGroupCalls = new Map<string, Set<string>>(); // chatRoomId -> Set<userId>
  private userRoomIds = new Map<string, string[]>(); // userId -> roomIds (cached for disconnect broadcast)

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private usersService: UsersService,
    private configService: ConfigService,
    private messagesRepository: MessagesRepository,
    private pushService: PushService,
    private chatRoomsRepository: ChatRoomsRepository,
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
      // Personal user-room so the server can target a specific user with events
      // (e.g. notify them of a brand-new chat room they've been added to).
      await client.join(`user:${client.user.userId}`);
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

      // Track active socket and cache room membership for disconnect broadcast
      this.activeSockets.set(client.user.userId, client);
      this.userRoomIds.set(client.user.userId, roomIds);

      // Broadcast online presence to all room members
      for (const roomId of roomIds) {
        client.to(roomId).emit('userStatus', {
          userId: client.user.userId,
          isOnline: true,
        });
      }

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

        // Broadcast offline presence to all room members using cached room list
        const roomIds = this.userRoomIds.get(client.user.userId) ?? [];
        for (const roomId of roomIds) {
          this.server.to(roomId).emit('userStatus', {
            userId: client.user.userId,
            isOnline: false,
          });
        }
        this.userRoomIds.delete(client.user.userId);
      }

      // --- Terminate active 1-on-1 call if disconnected during one ---
      const partnerId = this.activeCalls.get(client.user.userId);
      if (partnerId) {
        const partnerSocket = this.activeSockets.get(partnerId);
        if (partnerSocket) {
          partnerSocket.emit('callEnded', { reason: 'peer_disconnected' });
        }
        this.activeCalls.delete(client.user.userId);
        this.activeCalls.delete(partnerId);
      }

      // --- FR-026: Clean up group calls on disconnect ---
      for (const [chatRoomId, participants] of this.activeGroupCalls.entries()) {
        if (participants.has(client.user.userId)) {
          this._handleGroupCallLeave(chatRoomId, client.user.userId);
          break; // A user can only be in one group call at a time
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
        client.broadcast.to(payload.chatRoomId).emit('newMessage', message);

        // Notify participants who are not currently connected via push.
        const room = await this.chatRoomsRepository.findById(payload.chatRoomId);
        if (room) {
          for (const participantId of room.participants as any[]) {
            const id = participantId.toString();
            if (id !== client.user.userId && !this.activeSockets.has(id)) {
              this.pushService.notifyOfflineUser(id, {
                content: (message as any).content ?? '',
                senderName: client.user.phoneNumber,
                roomId: payload.chatRoomId,
              }).catch(() => {});
            }
          }
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

      const counts = await this.chatService.markMessagesRead(client.user.userId, payload.chatRoomId, idsToMark);

      client.broadcast.to(payload.chatRoomId).emit('messageRead', {
        chatRoomId: payload.chatRoomId,
        clientMessageIds: idsToMark,
        readBy: client.user.userId,
        ...(counts.readByCount !== undefined && {
          readByCount: counts.readByCount,
          participantCount: counts.participantCount,
        }),
      });

    } catch (e) {
      console.error('🛡️ Mark Read Error:', e.message);
    }
  }

  @SubscribeMessage('deleteForEveryone')
  async handleDeleteForEveryone(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { clientMessageId: string; chatRoomId: string },
  ) {
    if (!client.user) return;

    try {
      const deleted = await this.messagesRepository.softDelete(
        payload.clientMessageId,
        client.user.userId,
        CHAT_CONFIG.DELETE_WINDOW_MINUTES,
      );

      if (!deleted) return;

      this.server.to(payload.chatRoomId).emit('messageDeleted', {
        clientMessageId: payload.clientMessageId,
        chatRoomId: payload.chatRoomId,
      });
    } catch (e) {
      console.error('🛡️ Delete For Everyone Error:', e.message);
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Group Call Signaling (T044–T050)
  // ─────────────────────────────────────────────────────────────────────────────

  /** T045 — Caller initiates a group call; fans out to all online room members. */
  @SubscribeMessage('requestGroupCall')
  async handleRequestGroupCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string; isVideo: boolean },
  ) {
    if (!client.user) return;
    const { chatRoomId, isVideo } = payload;

    const room = await this.chatRoomsRepository.findOne({ _id: chatRoomId, participants: client.user.userId });
    if (!room) {
      client.emit('callError', { reason: 'not_a_participant' });
      return;
    }

    // Register caller in activeGroupCalls
    if (!this.activeGroupCalls.has(chatRoomId)) {
      this.activeGroupCalls.set(chatRoomId, new Set());
    }
    this.activeGroupCalls.get(chatRoomId)!.add(client.user.userId);

    const caller = await this.usersService.findById(client.user.userId);
    const callerName = caller?.phoneNumber ?? client.user.phoneNumber;

    // Fan-out to all online participants except the caller
    for (const participantId of room.participants as any[]) {
      const id = participantId.toString();
      if (id === client.user.userId) continue;
      const participantSocket = this.activeSockets.get(id);
      if (participantSocket) {
        participantSocket.emit('incomingGroupCall', {
          chatRoomId,
          callerUserId: client.user.userId,
          callerName,
          groupName: room.name ?? '',
          isVideo,
          currentParticipantCount: 1,
        });
      }
    }

    // Issue a LiveKit token for the caller so they can join the room immediately.
    // Other participants join via acceptGroupCall — the caller joins right away.
    const livekitUrl = this.configService.get<string>('LIVEKIT_WS_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    const callerToken = new AccessToken(apiKey, apiSecret, { identity: client.user.userId });
    callerToken.addGrant({ roomJoin: true, room: chatRoomId, canPublish: true, canSubscribe: true });
    const livekitToken = await callerToken.toJwt();

    client.emit('callAccepted', {
      chatRoomId,
      livekitUrl,
      livekitToken,
      currentParticipants: [client.user.userId],
    });

    this.logger.log(`[GroupCall] requestGroupCall room=${chatRoomId} by ${client.user.userId}`);
  }

  /** T046 — Invited member accepts; receives LiveKit token + participant list. */
  @SubscribeMessage('acceptGroupCall')
  async handleAcceptGroupCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string },
  ) {
    if (!client.user) return;
    const { chatRoomId } = payload;

    const participants = this.activeGroupCalls.get(chatRoomId);
    if (!participants) {
      client.emit('callError', { reason: 'no_active_group_call' });
      return;
    }

    // FR-027: Hard cap at 32 participants
    if (participants.size >= 32) {
      client.emit('callError', { reason: 'group_call_full' });
      return;
    }

    participants.add(client.user.userId);

    // Issue a LiveKit token using the chatRoomId as the LiveKit room name
    const livekitUrl = this.configService.get<string>('LIVEKIT_WS_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    const token = new AccessToken(apiKey, apiSecret, { identity: client.user.userId });
    token.addGrant({ roomJoin: true, room: chatRoomId, canPublish: true, canSubscribe: true });
    const livekitToken = await token.toJwt();

    client.emit('callAccepted', {
      chatRoomId,
      livekitUrl,
      livekitToken,
      currentParticipants: Array.from(participants),
    });

    // Broadcast to existing participants that someone joined
    for (const existingId of participants) {
      if (existingId === client.user.userId) continue;
      const s = this.activeSockets.get(existingId);
      if (s) {
        s.emit('groupCallParticipantJoined', {
          chatRoomId,
          userId: client.user.userId,
          phoneNumber: client.user.phoneNumber,
        });
      }
    }

    this.logger.log(`[GroupCall] acceptGroupCall room=${chatRoomId} by ${client.user.userId}`);
  }

  /** T047 — Member declines the invitation; no broadcast to others. */
  @SubscribeMessage('declineGroupCall')
  handleDeclineGroupCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string },
  ) {
    if (!client.user) return;
    this.logger.log(`[GroupCall] declineGroupCall room=${payload.chatRoomId} by ${client.user.userId}`);
    // No broadcast required; caller doesn't get notified on individual declines
  }

  /** T048 — Participant leaves; broadcasts to remaining; ends call if only one left. */
  @SubscribeMessage('leaveGroupCall')
  handleLeaveGroupCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string },
  ) {
    if (!client.user) return;
    this._handleGroupCallLeave(payload.chatRoomId, client.user.userId);
  }

  /** T049 — Recording state change; broadcasts to all participants in the group call. */
  @SubscribeMessage('groupCallRecordingStateChanged')
  handleGroupCallRecordingStateChanged(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string; isRecording: boolean },
  ) {
    if (!client.user) return;
    const { chatRoomId, isRecording } = payload;
    const participants = this.activeGroupCalls.get(chatRoomId);
    if (!participants) return;

    for (const userId of participants) {
      const s = this.activeSockets.get(userId);
      if (s) {
        s.emit('groupCallRecordingStateChanged', { chatRoomId, isRecording, recorderId: client.user.userId });
      }
    }
  }

  /** Shared leave logic used by both the explicit leaveGroupCall event and handleDisconnect. */
  private _handleGroupCallLeave(chatRoomId: string, userId: string): void {
    const participants = this.activeGroupCalls.get(chatRoomId);
    if (!participants || !participants.has(userId)) return;

    participants.delete(userId);

    // Notify remaining participants
    for (const remainingId of participants) {
      const s = this.activeSockets.get(remainingId);
      if (s) {
        s.emit('groupCallParticipantLeft', { chatRoomId, userId });
      }
    }

    // FR-026: If only one participant left, end the call for them too
    if (participants.size === 1) {
      const lastId = participants.values().next().value as string;
      const lastSocket = this.activeSockets.get(lastId);
      if (lastSocket) {
        lastSocket.emit('callEnded', { chatRoomId, reason: 'last-participant' });
      }
      this.activeGroupCalls.delete(chatRoomId);
    } else if (participants.size === 0) {
      this.activeGroupCalls.delete(chatRoomId);
    }

    this.logger.log(`[GroupCall] ${userId} left group call room=${chatRoomId}. Remaining: ${participants?.size ?? 0}`);
  }

  /** Broadcasts a room-level update to all connected participants. */
  broadcastRoomUpdated(roomId: string, data: Record<string, unknown>): void {
    this.server.to(roomId).emit('chatRoomUpdated', data);
  }

  /**
   * Notifies each user in [userIds] that a new chat room (group) has been
   * created and they are a participant. Each connected socket also joins
   * the new Socket.IO room so subsequent messages arrive immediately.
   */
  async broadcastNewChatRoom(
    userIds: string[],
    roomId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    for (const userId of userIds) {
      const personal = `user:${userId}`;
      // Subscribe every currently-connected socket of this user to the new room
      const sockets = await this.server.in(personal).fetchSockets();
      for (const s of sockets) {
        await s.join(roomId);
      }
      this.server.to(personal).emit('newChatRoom', data);
    }
  }
}
