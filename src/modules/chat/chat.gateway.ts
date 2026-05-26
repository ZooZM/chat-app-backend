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
import { Inject, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
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
  // FR-038: extended to track recorders, start time and call type (data-model.md §3a)
  private activeGroupCalls = new Map<string, {
    participants: Set<string>;
    recorders: Set<string>;
    startedAt: Date;
    isVideo: boolean;
  }>();
  private userRoomIds = new Map<string, string[]>(); // userId -> roomIds (cached for disconnect broadcast)
  // FR-012: tracks which chatRoomId each userId is actively sharing in (for disconnect cleanup)
  private userScreenShares = new Map<string, string>(); // userId -> chatRoomId

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
    private usersService: UsersService,
    private configService: ConfigService,
    private messagesRepository: MessagesRepository,
    private pushService: PushService,
    private chatRoomsRepository: ChatRoomsRepository,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
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

      // T090: FR-038 replay active group calls so the client can show Join Call pill immediately
      for (const [chatRoomId, callEntry] of this.activeGroupCalls.entries()) {
        if (roomIds.includes(chatRoomId)) {
          client.emit('groupCallActive', {
            chatRoomId,
            participantCount: callEntry.participants.size,
            isVideo: callEntry.isVideo,
            startedAt: callEntry.startedAt.toISOString(),
          });
        }
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
      for (const [chatRoomId, callEntry] of this.activeGroupCalls.entries()) {
        if (callEntry.participants.has(client.user.userId)) {
          this._handleGroupCallLeave(chatRoomId, client.user.userId);
          break; // A user can only be in one group call at a time
        }
      }

      // --- T005/FR-012: Clean up screen share lock on disconnect ---
      await this._handleScreenShareDisconnect(client.user.userId);
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

    // T087: Register caller in activeGroupCalls with full tracking object
    const startedAt = new Date();
    if (!this.activeGroupCalls.has(chatRoomId)) {
      this.activeGroupCalls.set(chatRoomId, {
        participants: new Set(),
        recorders: new Set(),
        startedAt,
        isVideo,
      });
    }
    this.activeGroupCalls.get(chatRoomId)!.participants.add(client.user.userId);

    const caller = await this.usersService.findById(client.user.userId);
    const callerName = caller?.phoneNumber ?? client.user.phoneNumber;

    // Fan-out incomingGroupCall to all online participants except the caller.
    // T088: Also broadcast groupCallActive to ALL room members (including caller)
    //       so the Join Call AppBar pill can appear for everyone (FR-038).
    const groupCallActivePayload = {
      chatRoomId,
      callerId: client.user.userId,
      callerName,
      isVideo,
      participantCount: 1,
      startedAt: startedAt.toISOString(),
    };

    for (const participantId of room.participants as any[]) {
      const id = participantId.toString();
      const participantSocket = this.activeSockets.get(id);
      if (!participantSocket) continue;

      if (id !== client.user.userId) {
        participantSocket.emit('incomingGroupCall', {
          chatRoomId,
          callerUserId: client.user.userId,
          callerName,
          groupName: room.name ?? '',
          isVideo,
          currentParticipantCount: 1,
        });
      }
      // groupCallActive to everyone including caller (FR-038)
      participantSocket.emit('groupCallActive', groupCallActivePayload);
    }

    // Issue a LiveKit token for the caller so they can join the room immediately.
    // Other participants join via acceptGroupCall — the caller joins right away.
    const livekitUrl = this.configService.get<string>('LIVEKIT_WS_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    const callerToken = new AccessToken(apiKey, apiSecret, {
      identity: client.user.userId,
      name: client.user.phoneNumber,
    });
    callerToken.addGrant({ roomJoin: true, room: chatRoomId, canPublish: true, canSubscribe: true });
    const livekitToken = await callerToken.toJwt();

    client.emit('callAccepted', {
      chatRoomId,
      livekitUrl,
      livekitToken,
      currentParticipants: [client.user.userId],
      currentRecorders: [],
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

    const callEntry = this.activeGroupCalls.get(chatRoomId);
    if (!callEntry) {
      client.emit('callError', { reason: 'no_active_group_call' });
      return;
    }

    // FR-027: Hard cap at 32 participants
    if (callEntry.participants.size >= 32) {
      client.emit('callError', { reason: 'group_call_full' });
      return;
    }

    callEntry.participants.add(client.user.userId);

    // Issue a LiveKit token using the chatRoomId as the LiveKit room name
    const livekitUrl = this.configService.get<string>('LIVEKIT_WS_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    const token = new AccessToken(apiKey, apiSecret, {
      identity: client.user.userId,
      name: client.user.phoneNumber,
    });
    token.addGrant({ roomJoin: true, room: chatRoomId, canPublish: true, canSubscribe: true });
    const livekitToken = await token.toJwt();

    // T089: include currentRecorders so late joiners can render the REC banner (RD-5)
    client.emit('callAccepted', {
      chatRoomId,
      livekitUrl,
      livekitToken,
      currentParticipants: Array.from(callEntry.participants),
      currentRecorders: Array.from(callEntry.recorders),
    });

    // Broadcast to existing participants that someone joined
    for (const existingId of callEntry.participants) {
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

  /** T049/T091 — Recording state change; broadcasts to all participants (includes hasVideo). */
  @SubscribeMessage('groupCallRecordingStateChanged')
  handleGroupCallRecordingStateChanged(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string; isRecording: boolean; hasVideo?: boolean },
  ) {
    if (!client.user) return;
    const { chatRoomId, isRecording, hasVideo = false } = payload;
    const callEntry = this.activeGroupCalls.get(chatRoomId);
    if (!callEntry) return;

    // T087: maintain recorders set
    if (isRecording) {
      callEntry.recorders.add(client.user.userId);
    } else {
      callEntry.recorders.delete(client.user.userId);
    }

    // T091: forward hasVideo so recipients can show the correct recording type banner
    for (const userId of callEntry.participants) {
      const s = this.activeSockets.get(userId);
      if (s) {
        s.emit('groupCallRecordingStateChanged', {
          chatRoomId,
          isRecording,
          hasVideo,
          recorderId: client.user.userId,
        });
      }
    }
  }

  /** Shared leave logic used by both the explicit leaveGroupCall event and handleDisconnect. */
  private _handleGroupCallLeave(chatRoomId: string, userId: string): void {
    const callEntry = this.activeGroupCalls.get(chatRoomId);
    if (!callEntry || !callEntry.participants.has(userId)) return;

    callEntry.participants.delete(userId);
    callEntry.recorders.delete(userId);

    // Notify remaining participants
    for (const remainingId of callEntry.participants) {
      const s = this.activeSockets.get(remainingId);
      if (s) {
        s.emit('groupCallParticipantLeft', { chatRoomId, userId });
      }
    }

    // FR-026 / T089: If only one participant left, end the call for them;
    //   then broadcast groupCallEnded to ALL room members (FR-038).
    if (callEntry.participants.size === 1) {
      const lastId = callEntry.participants.values().next().value as string;
      const lastSocket = this.activeSockets.get(lastId);
      if (lastSocket) {
        lastSocket.emit('callEnded', { chatRoomId, reason: 'last-participant' });
      }
      this.activeGroupCalls.delete(chatRoomId);
      // Broadcast groupCallEnded to the entire room channel (FR-038)
      this.server.to(chatRoomId).emit('groupCallEnded', {
        chatRoomId,
        reason: 'last-participant',
      });
    } else if (callEntry.participants.size === 0) {
      this.activeGroupCalls.delete(chatRoomId);
      this.server.to(chatRoomId).emit('groupCallEnded', {
        chatRoomId,
        reason: 'abandoned',
      });
    }

    this.logger.log(`[GroupCall] ${userId} left group call room=${chatRoomId}. Remaining: ${callEntry.participants.size}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Screen Share (T004 / FR-012)
  // ─────────────────────────────────────────────────────────────────────────────

  /** T004 — Single-sharer enforcement via Redis NX lock. */
  @SubscribeMessage('screenShareStateChanged')
  async handleScreenShareStateChanged(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: {
      chatRoomId: string;
      userId: string;
      userName: string;
      isSharing: boolean;
      withAudio: boolean;
    },
  ) {
    if (!client.user) return;
    const { chatRoomId, userId, userName, isSharing, withAudio } = payload;
    if (!chatRoomId || !userId) return;

    const lockKey = `screenshare:active:${chatRoomId}`;

    if (isSharing) {
      // Attempt to acquire the lock: SET NX with 6-hour TTL
      const result = await this.redis.set(lockKey, userId, 'EX', 21600, 'NX');

      if (result === 'OK') {
        // Lock acquired — re-broadcast to other sockets and ACK emitter
        this.userScreenShares.set(userId, chatRoomId);
        client.broadcast.to(chatRoomId).emit('screenShareStateChanged', { chatRoomId, userId, userName, isSharing, withAudio });
        client.emit('screenShareAccepted', { chatRoomId });
        this.logger.log(`[ScreenShare] ${userId} started sharing in room ${chatRoomId}`);
      } else {
        // Lock conflict — inform only the rejected emitter (FR-012)
        const activeSharerUserId = await this.redis.get(lockKey) ?? '';
        const activeSharer = activeSharerUserId ? await this.usersService.findById(activeSharerUserId) : null;
        const activeSharerName: string = (activeSharer as any)?.name ?? (activeSharer as any)?.phoneNumber ?? '';
        client.emit('screenShareRejected', {
          chatRoomId,
          activeSharerUserId,
          activeSharerName,
          reason: 'another_user_sharing',
        });
        this.logger.log(`[ScreenShare] Conflict: ${userId} tried to share in room ${chatRoomId}, blocked by ${activeSharerUserId}`);
      }
    } else {
      // Stop share — verify ownership before releasing lock
      const currentSharer = await this.redis.get(lockKey);
      if (currentSharer === userId) {
        await this.redis.del(lockKey);
        this.userScreenShares.delete(userId);
        client.broadcast.to(chatRoomId).emit('screenShareStateChanged', { chatRoomId, userId, userName, isSharing, withAudio });
        this.logger.log(`[ScreenShare] ${userId} stopped sharing in room ${chatRoomId}`);
      }
    }
  }

  /** T005 — Release screen share lock and broadcast stop on disconnect. */
  private async _handleScreenShareDisconnect(userId: string): Promise<void> {
    const chatRoomId = this.userScreenShares.get(userId);
    if (!chatRoomId) return;

    const lockKey = `screenshare:active:${chatRoomId}`;
    const currentSharer = await this.redis.get(lockKey);
    if (currentSharer === userId) {
      await this.redis.del(lockKey);
      this.server.to(chatRoomId).emit('screenShareStateChanged', {
        chatRoomId,
        userId,
        userName: '',
        isSharing: false,
        withAudio: false,
      });
      this.logger.log(`[ScreenShare] Zombie lock cleared for ${userId} in room ${chatRoomId} (disconnect)`);
    }
    this.userScreenShares.delete(userId);
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
