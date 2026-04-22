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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const group_dto_1 = require("./dto/group.dto");
const resolve_private_chat_dto_1 = require("./dto/resolve-private-chat.dto");
let ChatController = class ChatController {
    chatService;
    constructor(chatService) {
        this.chatService = chatService;
    }
    async getUserRooms(req, limit, cursor) {
        const l = limit ? parseInt(limit.toString(), 10) : 20;
        return this.chatService.getUserRooms(req.user.userId, l, cursor);
    }
    async getRoomMessages(roomId, limit, cursor) {
        const l = limit ? parseInt(limit.toString(), 10) : 50;
        return this.chatService.getRoomMessages(roomId, l, cursor);
    }
    async resolvePrivateChat(req, dto) {
        const { roomId, room } = await this.chatService.resolvePrivateRoom(req.user.userId, dto.userId);
        return { roomId, room };
    }
    async syncStatuses(dto) {
        return this.chatService.syncStatuses(dto.clientMessageIds);
    }
    async createGroup(req, dto) {
        const { userId, phoneNumber } = req.user;
        const group = await this.chatService.createGroup(phoneNumber, userId, dto);
        return {
            message: `Group "${dto.name}" created successfully.`,
            data: group,
        };
    }
    async addParticipants(req, roomId, dto) {
        const { phoneNumber } = req.user;
        const updated = await this.chatService.addParticipants(phoneNumber, roomId, dto);
        return {
            message: `${dto.phoneNumbersToAdd.length} participant(s) added.`,
            data: updated,
        };
    }
    async removeParticipant(req, roomId, dto) {
        const { phoneNumber } = req.user;
        const updated = await this.chatService.removeParticipant(phoneNumber, roomId, dto);
        return {
            message: `${dto.phoneNumberToRemove} has been removed from the group.`,
            data: updated,
        };
    }
    async leaveGroup(req, roomId) {
        const { userId, phoneNumber } = req.user;
        return this.chatService.leaveGroup(phoneNumber, userId, roomId);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('rooms'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getUserRooms", null);
__decorate([
    (0, common_1.Get)('rooms/:roomId/messages'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getRoomMessages", null);
__decorate([
    (0, common_1.Post)('private/resolve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, resolve_private_chat_dto_1.ResolvePrivateChatDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "resolvePrivateChat", null);
__decorate([
    (0, common_1.Post)('messages/sync-statuses'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "syncStatuses", null);
__decorate([
    (0, common_1.Post)('group/create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, group_dto_1.CreateGroupDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Post)('group/:roomId/add'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('roomId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, group_dto_1.AddParticipantsDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "addParticipants", null);
__decorate([
    (0, common_1.Post)('group/:roomId/remove'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('roomId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, group_dto_1.RemoveParticipantDto]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "removeParticipant", null);
__decorate([
    (0, common_1.Post)('group/:roomId/leave'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "leaveGroup", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map