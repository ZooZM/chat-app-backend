"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const chat_service_1 = require("./chat.service");
const send_message_dto_1 = require("./dto/send-message.dto");
const mark_read_dto_1 = require("./dto/mark-read.dto");
const mark_delivered_dto_1 = require("./dto/mark-delivered.dto");
const users_service_1 = require("../users/users.service");
const request_call_dto_1 = require("./dto/request-call.dto");
const accept_call_dto_1 = require("./dto/accept-call.dto");
const reject_call_dto_1 = require("./dto/reject-call.dto");
const messages_repository_1 = require("./messages.repository");
const chat_config_1 = require("./chat.config");
const push_service_1 = require("../notifications/push.service");
const chat_rooms_repository_1 = require("./chat-rooms.repository");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    jwtService;
    chatService;
    usersService;
    configService;
    messagesRepository;
    pushService;
    chatRoomsRepository;
    redis;
    server;
    activeSockets = new Map();
    activeCalls = new Map();
    activeGroupCalls = new Map();
    userRoomIds = new Map();
    userScreenShares = new Map();
    logger = new common_1.Logger(ChatGateway_1.name);
    constructor(jwtService, chatService, usersService, configService, messagesRepository, pushService, chatRoomsRepository, redis) {
        this.jwtService = jwtService;
        this.chatService = chatService;
        this.usersService = usersService;
        this.configService = configService;
        this.messagesRepository = messagesRepository;
        this.pushService = pushService;
        this.chatRoomsRepository = chatRoomsRepository;
        this.redis = redis;
    }
    async handleConnection(client) {
        try {
            const authHeader = client.handshake.headers.authorization;
            const queryToken = client.handshake.query.token;
            const authObjectToken = client.handshake.auth?.token;
            let token = queryToken || authObjectToken;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
            if (!token)
                throw new Error('Missing token');
            const payload = await this.jwtService.verifyAsync(token);
            client.user = { userId: payload.sub, phoneNumber: payload.phoneNumber };
            const userRooms = await this.chatService.getUserRoomsForSocket(client.user.userId);
            const roomIds = userRooms.map((room) => room._id.toString());
            await client.join(`user:${client.user.userId}`);
            if (roomIds.length > 0) {
                await client.join(roomIds);
            }
            this.logger.log(`[WS CONNECTED] User: ${client.user.userId} | Socket: ${client.id} | Auto-joined ${roomIds.length} room(s)`);
            await this.usersService.updateOnlineStatus(client.user.userId, true);
            for (const room of userRooms) {
                this.server.to(room._id.toString()).emit('userStatus', {
                    userId: client.user.userId,
                    isOnline: true,
                });
            }
            this.activeSockets.set(client.user.userId, client);
            this.userRoomIds.set(client.user.userId, roomIds);
            for (const roomId of roomIds) {
                client.to(roomId).emit('userStatus', {
                    userId: client.user.userId,
                    isOnline: true,
                });
            }
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
            client.emit('connected', {
                userId: client.user.userId,
                joinedRooms: roomIds,
            });
        }
        catch (error) {
            this.logger.warn(`[WS REJECTED] Socket: ${client.id} | Reason: ${error.message}`);
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        if (client.user) {
            if (this.activeSockets.get(client.user.userId)?.id === client.id) {
                this.activeSockets.delete(client.user.userId);
                await this.usersService.updateOnlineStatus(client.user.userId, false);
                const roomIds = this.userRoomIds.get(client.user.userId) ?? [];
                for (const roomId of roomIds) {
                    this.server.to(roomId).emit('userStatus', {
                        userId: client.user.userId,
                        isOnline: false,
                    });
                }
                this.userRoomIds.delete(client.user.userId);
            }
            const partnerId = this.activeCalls.get(client.user.userId);
            if (partnerId) {
                const partnerSocket = this.activeSockets.get(partnerId);
                if (partnerSocket) {
                    partnerSocket.emit('callEnded', { reason: 'peer_disconnected' });
                }
                this.activeCalls.delete(client.user.userId);
                this.activeCalls.delete(partnerId);
            }
            for (const [chatRoomId, callEntry] of this.activeGroupCalls.entries()) {
                if (callEntry.participants.has(client.user.userId)) {
                    this._handleGroupCallLeave(chatRoomId, client.user.userId);
                    break;
                }
            }
            await this._handleScreenShareDisconnect(client.user.userId);
        }
        this.logger.log(`[WS DISCONNECTED] Socket: ${client.id} | User: ${client.user?.userId ?? 'unauthenticated'}`);
    }
    async handleJoinRoom(client, roomId) {
        if (!client.user)
            return;
        await client.join(roomId);
        this.logger.log(`User ${client.user.userId} manually joined room ${roomId}`);
        return { event: 'joinedRoom', data: roomId };
    }
    async handleSendMessage(client, payload) {
        if (!client.user)
            return;
        const user = client.user;
        try {
            console.log('🚀 Payload received from Flutter:', payload);
            const { message, isNew } = await this.chatService.saveMessage(user.userId, payload);
            client.emit('messageSent', {
                clientMessageId: payload.clientMessageId,
                createdAt: message.createdAt
            });
            if (isNew) {
                client.broadcast.to(payload.chatRoomId).emit('newMessage', message);
                const room = await this.chatRoomsRepository.findById(payload.chatRoomId);
                if (room) {
                    for (const participantId of room.participants) {
                        const id = participantId.toString();
                        if (id !== client.user.userId && !this.activeSockets.has(id)) {
                            this.pushService.notifyOfflineUser(id, {
                                content: message.content ?? '',
                                senderName: client.user.phoneNumber,
                                roomId: payload.chatRoomId,
                            }).catch(() => { });
                        }
                    }
                }
            }
            else {
                console.log(`⚡ Duplicate suppressed for clientMessageId: ${payload.clientMessageId}`);
            }
        }
        catch (e) {
            console.error('Send Message Error:', e.message);
            client.emit('error', { message: e.message });
        }
    }
    handleTyping(client, payload) {
        if (!client.user)
            return;
        client.to(payload.roomId).emit('userTyping', {
            chatRoomId: payload.roomId,
            userId: client.user.userId,
            phoneNumber: client.user.phoneNumber,
            isTyping: payload.isTyping,
        });
    }
    async handleMarkDelivered(client, payload) {
        if (!client.user)
            return;
        try {
            console.log('🚀 Payload received from Flutter(markDelivered):', payload);
            const idsToMark = payload.clientMessageIds ? payload.clientMessageIds : (payload.clientMessageId ? [payload.clientMessageId] : []);
            if (idsToMark.length === 0)
                return;
            await this.chatService.markMessagesDelivered(client.user.userId, payload.chatRoomId, idsToMark);
            client.broadcast.to(payload.chatRoomId).emit('messageDelivered', {
                chatRoomId: payload.chatRoomId,
                clientMessageIds: idsToMark,
                deliveredTo: client.user.userId,
            });
        }
        catch (e) {
            console.error('🛡️ Mark Delivered Error:', e.message);
        }
    }
    async handleMarkRead(client, payload) {
        if (!client.user)
            return;
        try {
            const idsToMark = payload.clientMessageIds ? payload.clientMessageIds : (payload.clientMessageId ? [payload.clientMessageId] : []);
            if (idsToMark.length === 0)
                return;
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
        }
        catch (e) {
            console.error('🛡️ Mark Read Error:', e.message);
        }
    }
    async handleDeleteForEveryone(client, payload) {
        if (!client.user)
            return;
        try {
            const deleted = await this.messagesRepository.softDelete(payload.clientMessageId, client.user.userId, chat_config_1.CHAT_CONFIG.DELETE_WINDOW_MINUTES);
            if (!deleted)
                return;
            this.server.to(payload.chatRoomId).emit('messageDeleted', {
                clientMessageId: payload.clientMessageId,
                chatRoomId: payload.chatRoomId,
            });
        }
        catch (e) {
            console.error('🛡️ Delete For Everyone Error:', e.message);
        }
    }
    async handleRequestCall(client, payload) {
        if (!client.user)
            return;
        try {
            const caller = await this.usersService.findById(client.user.userId);
            if (!caller)
                throw new Error('Caller not found');
            const targetUser = await this.usersService.findByPhoneNumber(payload.targetUserId);
            if (!targetUser) {
                client.emit('callError', { reason: 'user_not_found' });
                return;
            }
            const targetSocket = this.activeSockets.get(targetUser._id.toString());
            if (targetSocket) {
                targetSocket.emit('incomingCall', {
                    callerId: client.user.phoneNumber,
                    callerName: caller.name,
                    callerAvatar: '',
                    isVideo: payload.isVideo,
                });
                this.logger.log(`[Call] Call requested from ${client.user.userId} to ${payload.targetUserId}`);
            }
            else {
                client.emit('callError', { reason: 'target_offline' });
                this.logger.log(`[Call] Call requested from ${client.user.userId} to ${payload.targetUserId} but target is offline`);
            }
        }
        catch (e) {
            this.logger.warn(`[Call] requestCall error: ${e.message}`);
        }
    }
    async handleAcceptCall(client, payload) {
        if (!client.user)
            return;
        const callerUser = await this.usersService.findByPhoneNumber(payload.callerId);
        if (!callerUser) {
            client.emit('callError', { reason: 'caller_not_found' });
            return;
        }
        const callerDbId = callerUser._id.toString();
        const receiverDbId = client.user.userId;
        this.activeCalls.set(callerDbId, receiverDbId);
        this.activeCalls.set(receiverDbId, callerDbId);
        const callerSocket = this.activeSockets.get(callerDbId);
        const roomName = `call_${callerDbId}_${receiverDbId}`;
        const livekitUrl = this.configService.get('LIVEKIT_WS_URL');
        const apiKey = this.configService.get('LIVEKIT_API_KEY');
        const apiSecret = this.configService.get('LIVEKIT_API_SECRET');
        const callerToken = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
            identity: callerDbId,
        });
        callerToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
        const receiverToken = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
            identity: receiverDbId,
        });
        receiverToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
        if (callerSocket) {
            callerSocket.emit('callAccepted', {
                receiverId: receiverDbId,
                roomName,
                livekitUrl,
                livekitToken: await callerToken.toJwt(),
            });
        }
        client.emit('callAccepted', {
            callerId: payload.callerId,
            roomName,
            livekitUrl,
            livekitToken: await receiverToken.toJwt(),
        });
        this.logger.log(`[Call] User ${receiverDbId} accepted call from ${callerDbId}. Room: ${roomName}`);
    }
    async handleRejectCall(client, payload) {
        if (!client.user)
            return;
        const callerUser = await this.usersService.findByPhoneNumber(payload.callerId);
        if (!callerUser)
            return;
        const callerSocket = this.activeSockets.get(callerUser._id.toString());
        if (callerSocket) {
            callerSocket.emit('callRejected', { receiverId: client.user.userId });
        }
        this.logger.log(`[Call] User ${client.user.userId} rejected call from ${callerUser._id.toString()}`);
    }
    async handleEndCall(client) {
        if (!client.user)
            return;
        const userId = client.user.userId;
        const partnerId = this.activeCalls.get(userId);
        if (partnerId) {
            const partnerSocket = this.activeSockets.get(partnerId);
            if (partnerSocket) {
                partnerSocket.emit('callEnded', { reason: 'user_ended' });
            }
            this.activeCalls.delete(userId);
            this.activeCalls.delete(partnerId);
            this.logger.log(`[Call] Call ended between ${userId} and ${partnerId}`);
        }
    }
    async handleRequestGroupCall(client, payload) {
        if (!client.user)
            return;
        const { chatRoomId, isVideo } = payload;
        const room = await this.chatRoomsRepository.findOne({ _id: chatRoomId, participants: client.user.userId });
        if (!room) {
            client.emit('callError', { reason: 'not_a_participant' });
            return;
        }
        const startedAt = new Date();
        if (!this.activeGroupCalls.has(chatRoomId)) {
            this.activeGroupCalls.set(chatRoomId, {
                participants: new Set(),
                recorders: new Set(),
                startedAt,
                isVideo,
            });
        }
        this.activeGroupCalls.get(chatRoomId).participants.add(client.user.userId);
        const caller = await this.usersService.findById(client.user.userId);
        const callerName = caller?.phoneNumber ?? client.user.phoneNumber;
        const groupCallActivePayload = {
            chatRoomId,
            callerId: client.user.userId,
            callerName,
            isVideo,
            participantCount: 1,
            startedAt: startedAt.toISOString(),
        };
        for (const participantId of room.participants) {
            const id = participantId.toString();
            const participantSocket = this.activeSockets.get(id);
            if (!participantSocket)
                continue;
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
            participantSocket.emit('groupCallActive', groupCallActivePayload);
        }
        const livekitUrl = this.configService.get('LIVEKIT_WS_URL');
        const apiKey = this.configService.get('LIVEKIT_API_KEY');
        const apiSecret = this.configService.get('LIVEKIT_API_SECRET');
        const callerToken = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
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
    async handleAcceptGroupCall(client, payload) {
        if (!client.user)
            return;
        const { chatRoomId } = payload;
        const callEntry = this.activeGroupCalls.get(chatRoomId);
        if (!callEntry) {
            client.emit('callError', { reason: 'no_active_group_call' });
            return;
        }
        if (callEntry.participants.size >= 32) {
            client.emit('callError', { reason: 'group_call_full' });
            return;
        }
        callEntry.participants.add(client.user.userId);
        const livekitUrl = this.configService.get('LIVEKIT_WS_URL');
        const apiKey = this.configService.get('LIVEKIT_API_KEY');
        const apiSecret = this.configService.get('LIVEKIT_API_SECRET');
        const token = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
            identity: client.user.userId,
            name: client.user.phoneNumber,
        });
        token.addGrant({ roomJoin: true, room: chatRoomId, canPublish: true, canSubscribe: true });
        const livekitToken = await token.toJwt();
        client.emit('callAccepted', {
            chatRoomId,
            livekitUrl,
            livekitToken,
            currentParticipants: Array.from(callEntry.participants),
            currentRecorders: Array.from(callEntry.recorders),
        });
        for (const existingId of callEntry.participants) {
            if (existingId === client.user.userId)
                continue;
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
    handleDeclineGroupCall(client, payload) {
        if (!client.user)
            return;
        this.logger.log(`[GroupCall] declineGroupCall room=${payload.chatRoomId} by ${client.user.userId}`);
    }
    handleLeaveGroupCall(client, payload) {
        if (!client.user)
            return;
        this._handleGroupCallLeave(payload.chatRoomId, client.user.userId);
    }
    handleGroupCallRecordingStateChanged(client, payload) {
        if (!client.user)
            return;
        const { chatRoomId, isRecording, hasVideo = false } = payload;
        const callEntry = this.activeGroupCalls.get(chatRoomId);
        if (!callEntry)
            return;
        if (isRecording) {
            callEntry.recorders.add(client.user.userId);
        }
        else {
            callEntry.recorders.delete(client.user.userId);
        }
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
    _handleGroupCallLeave(chatRoomId, userId) {
        const callEntry = this.activeGroupCalls.get(chatRoomId);
        if (!callEntry || !callEntry.participants.has(userId))
            return;
        callEntry.participants.delete(userId);
        callEntry.recorders.delete(userId);
        for (const remainingId of callEntry.participants) {
            const s = this.activeSockets.get(remainingId);
            if (s) {
                s.emit('groupCallParticipantLeft', { chatRoomId, userId });
            }
        }
        if (callEntry.participants.size === 1) {
            const lastId = callEntry.participants.values().next().value;
            const lastSocket = this.activeSockets.get(lastId);
            if (lastSocket) {
                lastSocket.emit('callEnded', { chatRoomId, reason: 'last-participant' });
            }
            this.activeGroupCalls.delete(chatRoomId);
            this.server.to(chatRoomId).emit('groupCallEnded', {
                chatRoomId,
                reason: 'last-participant',
            });
        }
        else if (callEntry.participants.size === 0) {
            this.activeGroupCalls.delete(chatRoomId);
            this.server.to(chatRoomId).emit('groupCallEnded', {
                chatRoomId,
                reason: 'abandoned',
            });
        }
        this.logger.log(`[GroupCall] ${userId} left group call room=${chatRoomId}. Remaining: ${callEntry.participants.size}`);
    }
    async handleScreenShareStateChanged(client, payload) {
        if (!client.user)
            return;
        const { chatRoomId, userId, userName, isSharing, withAudio } = payload;
        if (!chatRoomId || !userId)
            return;
        const lockKey = `screenshare:active:${chatRoomId}`;
        if (isSharing) {
            const result = await this.redis.set(lockKey, userId, 'EX', 21600, 'NX');
            if (result === 'OK') {
                this.userScreenShares.set(userId, chatRoomId);
                client.broadcast.to(chatRoomId).emit('screenShareStateChanged', { chatRoomId, userId, userName, isSharing, withAudio });
                client.emit('screenShareAccepted', { chatRoomId });
                this.logger.log(`[ScreenShare] ${userId} started sharing in room ${chatRoomId}`);
            }
            else {
                const activeSharerUserId = await this.redis.get(lockKey) ?? '';
                const activeSharer = activeSharerUserId ? await this.usersService.findById(activeSharerUserId) : null;
                const activeSharerName = activeSharer?.name ?? activeSharer?.phoneNumber ?? '';
                client.emit('screenShareRejected', {
                    chatRoomId,
                    activeSharerUserId,
                    activeSharerName,
                    reason: 'another_user_sharing',
                });
                this.logger.log(`[ScreenShare] Conflict: ${userId} tried to share in room ${chatRoomId}, blocked by ${activeSharerUserId}`);
            }
        }
        else {
            const currentSharer = await this.redis.get(lockKey);
            if (currentSharer === userId) {
                await this.redis.del(lockKey);
                this.userScreenShares.delete(userId);
                client.broadcast.to(chatRoomId).emit('screenShareStateChanged', { chatRoomId, userId, userName, isSharing, withAudio });
                this.logger.log(`[ScreenShare] ${userId} stopped sharing in room ${chatRoomId}`);
            }
        }
    }
    async _handleScreenShareDisconnect(userId) {
        const chatRoomId = this.userScreenShares.get(userId);
        if (!chatRoomId)
            return;
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
    broadcastRoomUpdated(roomId, data) {
        this.server.to(roomId).emit('chatRoomUpdated', data);
    }
    async broadcastNewChatRoom(userIds, roomId, data) {
        for (const userId of userIds) {
            const personal = `user:${userId}`;
            const sockets = await this.server.in(personal).fetchSockets();
            for (const s of sockets) {
                await s.join(roomId);
            }
            this.server.to(personal).emit('newChatRoom', data);
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, send_message_dto_1.SendMessageDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, websockets_1.SubscribeMessage)('markDelivered'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, mark_delivered_dto_1.MarkDeliveredDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMarkDelivered", null);
__decorate([
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, websockets_1.SubscribeMessage)('markRead'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, mark_read_dto_1.MarkReadDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMarkRead", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('deleteForEveryone'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleDeleteForEveryone", null);
__decorate([
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, websockets_1.SubscribeMessage)('requestCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, request_call_dto_1.RequestCallDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleRequestCall", null);
__decorate([
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, websockets_1.SubscribeMessage)('acceptCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, accept_call_dto_1.AcceptCallDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleAcceptCall", null);
__decorate([
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, websockets_1.SubscribeMessage)('rejectCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reject_call_dto_1.RejectCallDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleRejectCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('endCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleEndCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('requestGroupCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleRequestGroupCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('acceptGroupCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleAcceptGroupCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('declineGroupCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleDeclineGroupCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveGroupCall'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeaveGroupCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('groupCallRecordingStateChanged'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleGroupCallRecordingStateChanged", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('screenShareStateChanged'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleScreenShareStateChanged", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    }),
    __param(7, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        chat_service_1.ChatService,
        users_service_1.UsersService,
        config_1.ConfigService,
        messages_repository_1.MessagesRepository,
        push_service_1.PushService,
        chat_rooms_repository_1.ChatRoomsRepository, Function])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map