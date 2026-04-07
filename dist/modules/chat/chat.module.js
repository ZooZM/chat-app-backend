"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_module_1 = require("../auth/auth.module");
const chat_room_schema_1 = require("./schemas/chat-room.schema");
const message_schema_1 = require("./schemas/message.schema");
const chat_service_1 = require("./chat.service");
const chat_gateway_1 = require("./chat.gateway");
const chat_controller_1 = require("./chat.controller");
const jwt_1 = require("@nestjs/jwt");
const chat_rooms_repository_1 = require("./chat-rooms.repository");
const messages_repository_1 = require("./messages.repository");
let ChatModule = class ChatModule {
};
exports.ChatModule = ChatModule;
exports.ChatModule = ChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: chat_room_schema_1.ChatRoom.name, schema: chat_room_schema_1.ChatRoomSchema },
                { name: message_schema_1.Message.name, schema: message_schema_1.MessageSchema },
            ]),
            auth_module_1.AuthModule,
            jwt_1.JwtModule,
        ],
        providers: [chat_service_1.ChatService, chat_gateway_1.ChatGateway, chat_rooms_repository_1.ChatRoomsRepository, messages_repository_1.MessagesRepository],
        exports: [chat_service_1.ChatService, chat_rooms_repository_1.ChatRoomsRepository, messages_repository_1.MessagesRepository],
        controllers: [chat_controller_1.ChatController],
    })
], ChatModule);
//# sourceMappingURL=chat.module.js.map