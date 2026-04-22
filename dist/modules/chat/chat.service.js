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
const chat_room_schema_1 = require("./schemas/chat-room.schema");
const message_schema_1 = require("./schemas/message.schema");
const chat_rooms_repository_1 = require("./chat-rooms.repository");
const messages_repository_1 = require("./messages.repository");
const users_repository_1 = require("../users/users.repository");
let ChatService = class ChatService {
    chatRoomsRepository;
    messagesRepository;
    usersRepository;
    constructor(chatRoomsRepository, messagesRepository, usersRepository) {
        this.chatRoomsRepository = chatRoomsRepository;
        this.messagesRepository = messagesRepository;
        this.usersRepository = usersRepository;
    }
    async createPrivateRoom(userA, userB) {
        const existing = await this.chatRoomsRepository.findPrivateRoom(userA, userB);
        if (existing)
            return existing;
        const participants = [new mongoose_1.Types.ObjectId(userA), new mongoose_1.Types.ObjectId(userB)];
        return this.chatRoomsRepository.create({ type: 'PRIVATE', participants });
    }
    async resolvePrivateRoom(requesterId, targetUserId) {
        const targetUser = await this.usersRepository.findById(targetUserId);
        if (!targetUser) {
            throw new common_1.NotFoundException(`User with ID "${targetUserId}" is not registered.`);
        }
        const targetId = targetUser._id.toString();
        if (targetId === requesterId) {
            throw new common_1.BadRequestException('You cannot start a chat with yourself.');
        }
        let room = await this.chatRoomsRepository.findPrivateRoom(requesterId, targetId);
        if (!room) {
            const participants = [new mongoose_1.Types.ObjectId(requesterId), new mongoose_1.Types.ObjectId(targetId)];
            room = await this.chatRoomsRepository.create({ type: chat_room_schema_1.ChatRoomType.PRIVATE, participants });
        }
        return { roomId: room._id.toString(), room };
    }
    async saveMessage(senderId, payload) {
        const room = await this.chatRoomsRepository.findById(payload.chatRoomId);
        if (!room)
            throw new common_1.NotFoundException('Chat room not found');
        if (payload.clientMessageId) {
            const existing = await this.messagesRepository.findByClientMessageId(payload.clientMessageId);
            if (existing) {
                return { message: existing, isNew: false };
            }
        }
        const savedMessage = await this.messagesRepository.create({
            chatRoomId: new mongoose_1.Types.ObjectId(payload.chatRoomId),
            senderId: new mongoose_1.Types.ObjectId(senderId),
            content: payload.content,
            clientMessageId: payload.clientMessageId,
        });
        await this.chatRoomsRepository.updateLastMessage(payload.chatRoomId, savedMessage._id.toString());
        return { message: savedMessage, isNew: true };
    }
    async saveSystemMessage(roomId, content) {
        const message = await this.messagesRepository.create({
            chatRoomId: new mongoose_1.Types.ObjectId(roomId),
            senderId: new mongoose_1.Types.ObjectId('000000000000000000000000'),
            content,
            messageType: message_schema_1.MessageType.SYSTEM,
        });
        await this.chatRoomsRepository.updateLastMessage(roomId, message._id.toString());
    }
    async getUserRooms(userId, limit = 20, cursor) {
        return this.chatRoomsRepository.getUserRooms(userId, limit, cursor);
    }
    async getUserRoomsForSocket(userId) {
        return this.chatRoomsRepository.getUserRoomIds(userId);
    }
    async getRoomMessages(roomId, limit = 50, cursor) {
        return this.messagesRepository.getRoomMessages(roomId, limit, cursor);
    }
    async markMessagesRead(userId, roomId, messageIds) {
        const room = await this.chatRoomsRepository.findOne({
            _id: roomId,
            participants: userId,
        });
        if (!room) {
            throw new common_1.ForbiddenException('Unauthorized to read messages in this room');
        }
        return this.messagesRepository.markRead(messageIds, userId);
    }
    async markMessagesDelivered(userId, roomId, messageIds) {
        const room = await this.chatRoomsRepository.findOne({
            _id: roomId,
            participants: userId,
        });
        if (!room) {
            throw new common_1.ForbiddenException('Unauthorized to mark messages as delivered in this room');
        }
        return this.messagesRepository.markDelivered(messageIds, userId);
    }
    async syncStatuses(clientMessageIds) {
        return this.messagesRepository.fetchStatusesByClientIds(clientMessageIds);
    }
    async createGroup(creatorPhoneNumber, creatorId, dto) {
        const participantIds = await this.resolvePhoneNumbersToObjectIds([
            creatorPhoneNumber,
            ...dto.participants,
        ]);
        const room = await this.chatRoomsRepository.create({
            type: chat_room_schema_1.ChatRoomType.GROUP,
            name: dto.name,
            avatarUrl: dto.avatarUrl,
            participants: participantIds,
            admins: [creatorPhoneNumber],
        });
        await this.saveSystemMessage(room._id.toString(), `${creatorPhoneNumber} created the group "${dto.name}"`);
        return room;
    }
    async addParticipants(requesterPhoneNumber, roomId, dto) {
        const room = await this.findGroupOrFail(roomId);
        this.assertIsAdmin(room, requesterPhoneNumber);
        const newUserIds = await this.resolvePhoneNumbersToObjectIds(dto.phoneNumbersToAdd);
        const updated = await this.chatRoomsRepository.addParticipants(roomId, newUserIds);
        const addedList = dto.phoneNumbersToAdd.join(', ');
        await this.saveSystemMessage(roomId, `${requesterPhoneNumber} added ${addedList}`);
        return updated;
    }
    async removeParticipant(requesterPhoneNumber, roomId, dto) {
        const room = await this.findGroupOrFail(roomId);
        this.assertIsAdmin(room, requesterPhoneNumber);
        if (dto.phoneNumberToRemove === requesterPhoneNumber) {
            throw new common_1.BadRequestException('Admins cannot remove themselves. Use the /leave endpoint instead.');
        }
        const targetUser = await this.usersRepository.findByPhoneNumber(dto.phoneNumberToRemove);
        if (!targetUser)
            throw new common_1.NotFoundException(`User "${dto.phoneNumberToRemove}" not found.`);
        const updated = await this.chatRoomsRepository.removeParticipant(roomId, targetUser._id);
        if (room.admins.includes(dto.phoneNumberToRemove)) {
            await this.chatRoomsRepository.removeAdmin(roomId, dto.phoneNumberToRemove);
        }
        await this.saveSystemMessage(roomId, `${requesterPhoneNumber} removed ${dto.phoneNumberToRemove}`);
        return updated;
    }
    async leaveGroup(requesterPhoneNumber, requesterUserId, roomId) {
        const room = await this.findGroupOrFail(roomId);
        const isAdmin = room.admins.includes(requesterPhoneNumber);
        const isLastAdmin = isAdmin && room.admins.length === 1;
        if (isLastAdmin) {
            const otherParticipants = room.participants.filter((p) => p.toString() !== requesterUserId);
            if (otherParticipants.length === 0) {
            }
            else {
                const randomIndex = Math.floor(Math.random() * otherParticipants.length);
                const promotedId = otherParticipants[randomIndex].toString();
                const promotedUser = await this.usersRepository.findById(promotedId);
                if (promotedUser) {
                    await this.chatRoomsRepository.addAdmin(roomId, promotedUser.phoneNumber);
                    await this.saveSystemMessage(roomId, `${promotedUser.phoneNumber} is now an admin (${requesterPhoneNumber} left the group)`);
                }
            }
            await this.chatRoomsRepository.removeAdmin(roomId, requesterPhoneNumber);
        }
        else {
            await this.saveSystemMessage(roomId, `${requesterPhoneNumber} left the group`);
        }
        const user = await this.usersRepository.findById(requesterUserId);
        if (user) {
            await this.chatRoomsRepository.removeParticipant(roomId, user._id);
        }
        return { message: 'You have left the group.' };
    }
    async findGroupOrFail(roomId) {
        const room = await this.chatRoomsRepository.findById(roomId);
        if (!room)
            throw new common_1.NotFoundException('Chat room not found.');
        if (room.type !== chat_room_schema_1.ChatRoomType.GROUP)
            throw new common_1.BadRequestException('This operation is only valid for group chats.');
        return room;
    }
    assertIsAdmin(room, phoneNumber) {
        if (!room.admins.includes(phoneNumber)) {
            throw new common_1.ForbiddenException('Only group admins can perform this action.');
        }
    }
    async resolvePhoneNumbersToObjectIds(phoneNumbers) {
        const uniqueNumbers = [...new Set(phoneNumbers)];
        const objectIds = [];
        for (const phone of uniqueNumbers) {
            const user = await this.usersRepository.findByPhoneNumber(phone);
            if (!user)
                throw new common_1.NotFoundException(`User with phone number "${phone}" not found.`);
            objectIds.push(user._id);
        }
        return objectIds;
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [chat_rooms_repository_1.ChatRoomsRepository,
        messages_repository_1.MessagesRepository,
        users_repository_1.UsersRepository])
], ChatService);
//# sourceMappingURL=chat.service.js.map