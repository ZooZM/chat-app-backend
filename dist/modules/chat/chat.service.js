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
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_room_schema_1 = require("./schemas/chat-room.schema");
const message_schema_1 = require("./schemas/message.schema");
let ChatService = class ChatService {
    chatRoomModel;
    messageModel;
    constructor(chatRoomModel, messageModel) {
        this.chatRoomModel = chatRoomModel;
        this.messageModel = messageModel;
    }
    async createPrivateRoom(userA, userB) {
        const participants = [new mongoose_2.Types.ObjectId(userA), new mongoose_2.Types.ObjectId(userB)];
        const existing = await this.chatRoomModel.findOne({
            type: 'PRIVATE',
            participants: { $all: participants, $size: 2 },
        });
        if (existing)
            return existing;
        const newRoom = new this.chatRoomModel({ type: 'PRIVATE', participants });
        return newRoom.save();
    }
    async saveMessage(senderId, payload) {
        const room = await this.chatRoomModel.findById(payload.chatRoomId);
        if (!room)
            throw new common_1.NotFoundException('Chat room not found');
        const message = new this.messageModel({
            chatRoomId: new mongoose_2.Types.ObjectId(payload.chatRoomId),
            senderId: new mongoose_2.Types.ObjectId(senderId),
            content: payload.content,
            status: message_schema_1.MessageStatus.SENT,
        });
        const savedMessage = await message.save();
        room.lastMessage = savedMessage._id;
        await room.save();
        return savedMessage;
    }
    async getUserRooms(userId, limit = 20, cursor) {
        const query = { participants: new mongoose_2.Types.ObjectId(userId) };
        if (cursor) {
            query._id = { $lt: new mongoose_2.Types.ObjectId(cursor) };
        }
        return this.chatRoomModel
            .find(query)
            .sort({ updatedAt: -1 })
            .limit(limit)
            .populate('lastMessage')
            .populate('participants', 'name phoneNumber')
            .exec();
    }
    async getRoomMessages(roomId, limit = 50, cursor) {
        const query = { chatRoomId: new mongoose_2.Types.ObjectId(roomId) };
        if (cursor) {
            query._id = { $lt: new mongoose_2.Types.ObjectId(cursor) };
        }
        return this.messageModel
            .find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('senderId', 'name phoneNumber')
            .exec();
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_room_schema_1.ChatRoom.name)),
    __param(1, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map