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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const chat_service_1 = require("./chat.service");
const send_message_dto_1 = require("./dto/send-message.dto");
let ChatGateway = class ChatGateway {
    jwtService;
    chatService;
    server;
    constructor(jwtService, chatService) {
        this.jwtService = jwtService;
        this.chatService = chatService;
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
            console.log(`[WS CONNECTED] Client: ${client.id}, User: ${client.user.userId}`);
        }
        catch (error) {
            console.log(`[WS REJECTED] Client: ${client.id}`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        console.log(`[WS DISCONNECTED] Client: ${client.id}`);
    }
    async handleJoinRoom(client, roomId) {
        if (!client.user)
            return;
        client.join(roomId);
        console.log(`User ${client.user.userId} joined room ${roomId}`);
        return { event: 'joinedRoom', data: roomId };
    }
    async handleSendMessage(client, payload) {
        if (!client.user)
            return;
        try {
            const savedMessage = await this.chatService.saveMessage(client.user.userId, payload);
            this.server.to(payload.chatRoomId).emit('newMessage', savedMessage);
            return { event: 'messageSent', data: savedMessage._id };
        }
        catch (e) {
            return { event: 'error', data: e.message };
        }
    }
    handleTyping(client, payload) {
        if (!client.user)
            return;
        client.to(payload.roomId).emit('userTyping', {
            userId: client.user.userId,
            isTyping: payload.isTyping,
        });
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
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        chat_service_1.ChatService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map