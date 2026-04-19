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
exports.MessageSchema = exports.Message = exports.MessageType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "TEXT";
    MessageType["IMAGE"] = "IMAGE";
    MessageType["SYSTEM"] = "SYSTEM";
})(MessageType || (exports.MessageType = MessageType = {}));
let Message = class Message {
    chatRoomId;
    senderId;
    content;
    messageType;
    deliveredTo;
    readBy;
};
exports.Message = Message;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ChatRoom', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Message.prototype, "chatRoomId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Message.prototype, "senderId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Message.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: MessageType, default: MessageType.TEXT }),
    __metadata("design:type", String)
], Message.prototype, "messageType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Message.prototype, "deliveredTo", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Message.prototype, "readBy", void 0);
exports.Message = Message = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Message);
exports.MessageSchema = mongoose_1.SchemaFactory.createForClass(Message);
exports.MessageSchema.index({ chatRoomId: 1, _id: -1 });
//# sourceMappingURL=message.schema.js.map