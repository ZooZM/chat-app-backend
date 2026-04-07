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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const message_schema_1 = require("./schemas/message.schema");
const chat_rooms_repository_1 = require("./chat-rooms.repository");
const messages_repository_1 = require("./messages.repository");
let ChatService = class ChatService {
    chatRoomsRepository;
    messagesRepository;
    constructor(chatRoomsRepository, messagesRepository) {
        this.chatRoomsRepository = chatRoomsRepository;
        this.messagesRepository = messagesRepository;
    }
    async createPrivateRoom(userA, userB) {
        const existing = await this.chatRoomsRepository.findPrivateRoom(userA, userB);
        if (existing)
            return existing;
        const participants = [new mongoose_1.Types.ObjectId(userA), new mongoose_1.Types.ObjectId(userB)];
        return this.chatRoomsRepository.create({ type: 'PRIVATE', participants });
    }
    async saveMessage(senderId, payload) {
        const room = await this.chatRoomsRepository.findById(payload.chatRoomId);
        if (!room)
            throw new common_1.NotFoundException('Chat room not found');
        const savedMessage = await this.messagesRepository.create({
            chatRoomId: new mongoose_1.Types.ObjectId(payload.chatRoomId),
            senderId: new mongoose_1.Types.ObjectId(senderId),
            content: payload.content,
            status: message_schema_1.MessageStatus.SENT,
        });
        await this.chatRoomsRepository.updateLastMessage(payload.chatRoomId, savedMessage._id.toString());
        return savedMessage;
    }
    async getUserRooms(userId, limit = 20, cursor) {
        return this.chatRoomsRepository.getUserRooms(userId, limit, cursor);
    }
    async getRoomMessages(roomId, limit = 50, cursor) {
        return this.messagesRepository.getRoomMessages(roomId, limit, cursor);
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [chat_rooms_repository_1.ChatRoomsRepository,
        messages_repository_1.MessagesRepository])
], ChatService);
//# sourceMappingURL=chat.service.js.map