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
exports.VideoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const chat_rooms_repository_1 = require("../chat/chat-rooms.repository");
let VideoService = class VideoService {
    configService;
    chatRoomsRepository;
    constructor(configService, chatRoomsRepository) {
        this.configService = configService;
        this.chatRoomsRepository = chatRoomsRepository;
    }
    async generateRoomToken(userId, userName, roomId) {
        const isLegacyCallRoom = roomId.startsWith('call_');
        if (!isLegacyCallRoom) {
            const room = await this.chatRoomsRepository.findOne({
                _id: roomId,
                participants: userId,
            });
            if (!room) {
                throw new common_1.ForbiddenException('You are not a participant of this room.');
            }
        }
        const apiKey = this.configService.get('LIVEKIT_API_KEY');
        const apiSecret = this.configService.get('LIVEKIT_API_SECRET');
        const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
            identity: userId,
            name: userName,
        });
        at.addGrant({
            roomJoin: true,
            room: roomId,
            canPublish: true,
            canSubscribe: true,
        });
        return await at.toJwt();
    }
};
exports.VideoService = VideoService;
exports.VideoService = VideoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        chat_rooms_repository_1.ChatRoomsRepository])
], VideoService);
//# sourceMappingURL=video.service.js.map