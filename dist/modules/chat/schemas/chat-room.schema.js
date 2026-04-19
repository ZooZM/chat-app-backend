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
exports.ChatRoomSchema = exports.ChatRoom = exports.ChatRoomType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var ChatRoomType;
(function (ChatRoomType) {
    ChatRoomType["PRIVATE"] = "PRIVATE";
    ChatRoomType["GROUP"] = "GROUP";
})(ChatRoomType || (exports.ChatRoomType = ChatRoomType = {}));
let ChatRoom = class ChatRoom {
    participants;
    type;
    lastMessage;
    name;
    avatarUrl;
    admins;
};
exports.ChatRoom = ChatRoom;
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'User' }], required: true }),
    __metadata("design:type", Array)
], ChatRoom.prototype, "participants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ChatRoomType, default: ChatRoomType.PRIVATE }),
    __metadata("design:type", String)
], ChatRoom.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Message', required: false }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ChatRoom.prototype, "lastMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: false, trim: true }),
    __metadata("design:type", String)
], ChatRoom.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: false }),
    __metadata("design:type", String)
], ChatRoom.prototype, "avatarUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ChatRoom.prototype, "admins", void 0);
exports.ChatRoom = ChatRoom = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ChatRoom);
exports.ChatRoomSchema = mongoose_1.SchemaFactory.createForClass(ChatRoom);
exports.ChatRoomSchema.index({ participants: 1, updatedAt: -1 });
//# sourceMappingURL=chat-room.schema.js.map