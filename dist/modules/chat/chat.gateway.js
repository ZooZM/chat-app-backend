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
const users_service_1 = require("../users/users.service");
const request_call_dto_1 = require("./dto/request-call.dto");
const accept_call_dto_1 = require("./dto/accept-call.dto");
const reject_call_dto_1 = require("./dto/reject-call.dto");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    jwtService;
    chatService;
    usersService;
    configService;
    server;
    activeSockets = new Map();
    activeCalls = new Map();
    logger = new common_1.Logger(ChatGateway_1.name);
    constructor(jwtService, chatService, usersService, configService) {
        this.jwtService = jwtService;
        this.chatService = chatService;
        this.usersService = usersService;
        this.configService = configService;
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
            if (roomIds.length > 0) {
                await client.join(roomIds);
            }
            this.logger.log(`[WS CONNECTED] User: ${client.user.userId} | Socket: ${client.id} | Auto-joined ${roomIds.length} room(s)`);
            await this.usersService.updateOnlineStatus(client.user.userId, true);
            this.activeSockets.set(client.user.userId, client);
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
        try {
            console.log('🚀 Payload received from Flutter:', payload);
            const savedMessage = await this.chatService.saveMessage(client.user.userId, payload);
            client.emit('messageDelivered', { messageId: payload.messageId });
            client.broadcast.to(payload.chatRoomId).emit('newMessage', savedMessage);
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
            userId: client.user.userId,
            phoneNumber: client.user.phoneNumber,
            isTyping: payload.isTyping,
        });
    }
    async handleMarkRead(client, payload) {
        if (!client.user)
            return;
        try {
            const idsToMark = payload.messageIds ? payload.messageIds : (payload.messageId ? [payload.messageId] : []);
            console.log('🚀 Payload received from Flutter:', payload);
            if (idsToMark.length === 0)
                return;
            await this.chatService.markMessagesRead(client.user.userId, payload.chatRoomId, idsToMark);
            client.broadcast.to(payload.chatRoomId).emit('messagesRead', {
                chatRoomId: payload.chatRoomId,
                messageIds: idsToMark,
                readBy: client.user.userId,
            });
        }
        catch (e) {
            console.error('🛡️ Mark Read Error:', e.message);
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
    (0, websockets_1.SubscribeMessage)('markRead'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, mark_read_dto_1.MarkReadDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMarkRead", null);
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
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        chat_service_1.ChatService,
        users_service_1.UsersService,
        config_1.ConfigService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map