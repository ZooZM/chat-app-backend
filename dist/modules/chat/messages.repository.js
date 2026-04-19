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
exports.MessagesRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const base_repository_1 = require("../../common/repositories/base.repository");
const message_schema_1 = require("./schemas/message.schema");
let MessagesRepository = class MessagesRepository extends base_repository_1.BaseRepository {
    messageModel;
    constructor(messageModel) {
        super(messageModel);
        this.messageModel = messageModel;
    }
    async getRoomMessages(roomId, limit, cursor) {
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
    async markRead(messageIds, phoneNumber) {
        await this.messageModel.updateMany({ _id: { $in: messageIds.map((id) => new mongoose_2.Types.ObjectId(id)) } }, { $addToSet: { readBy: phoneNumber } }).exec();
    }
};
exports.MessagesRepository = MessagesRepository;
exports.MessagesRepository = MessagesRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], MessagesRepository);
//# sourceMappingURL=messages.repository.js.map