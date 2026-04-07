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
exports.ChatRoomsRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const base_repository_1 = require("../../common/repositories/base.repository");
const chat_room_schema_1 = require("./schemas/chat-room.schema");
let ChatRoomsRepository = class ChatRoomsRepository extends base_repository_1.BaseRepository {
    chatRoomModel;
    constructor(chatRoomModel) {
        super(chatRoomModel);
        this.chatRoomModel = chatRoomModel;
    }
    async findPrivateRoom(userA, userB) {
        const participants = [new mongoose_2.Types.ObjectId(userA), new mongoose_2.Types.ObjectId(userB)];
        return this.chatRoomModel.findOne({
            type: 'PRIVATE',
            participants: { $all: participants, $size: 2 },
        }).exec();
    }
    async getUserRooms(userId, limit, cursor) {
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
    async updateLastMessage(roomId, messageId) {
        await this.chatRoomModel.updateOne({ _id: new mongoose_2.Types.ObjectId(roomId) }, { lastMessage: new mongoose_2.Types.ObjectId(messageId) }).exec();
    }
    async findById(roomId) {
        return this.chatRoomModel.findById(roomId).exec();
    }
};
exports.ChatRoomsRepository = ChatRoomsRepository;
exports.ChatRoomsRepository = ChatRoomsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_room_schema_1.ChatRoom.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ChatRoomsRepository);
//# sourceMappingURL=chat-rooms.repository.js.map