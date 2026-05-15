import { Types } from 'mongoose';
import { ChatRoomDocument } from './schemas/chat-room.schema';
import { MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateGroupDto, AddParticipantsDto, RemoveParticipantDto } from './dto/group.dto';
import { ChatRoomsRepository } from './chat-rooms.repository';
import { MessagesRepository } from './messages.repository';
import { UsersRepository } from '../users/users.repository';
export declare class ChatService {
    private readonly chatRoomsRepository;
    private readonly messagesRepository;
    private readonly usersRepository;
    constructor(chatRoomsRepository: ChatRoomsRepository, messagesRepository: MessagesRepository, usersRepository: UsersRepository);
    createPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument>;
    resolvePrivateRoom(requesterId: string, targetUserId: string): Promise<{
        roomId: string;
        room: ChatRoomDocument;
    }>;
    saveMessage(senderId: string, payload: SendMessageDto): Promise<{
        message: MessageDocument;
        isNew: boolean;
    }>;
    private saveSystemMessage;
    getUserRooms(userId: string, limit?: number, cursor?: string): Promise<ChatRoomDocument[]>;
    getUserRoomsForSocket(userId: string): Promise<{
        _id: any;
    }[]>;
    getRoomById(roomId: string): Promise<ChatRoomDocument | null>;
    getRoomMessages(roomId: string, limit?: number, cursor?: string): Promise<MessageDocument[]>;
    markMessagesRead(userId: string, roomId: string, messageIds: string[]): Promise<{
        readByCount?: number;
        participantCount?: number;
    }>;
    markMessagesDelivered(userId: string, roomId: string, messageIds: string[]): Promise<void>;
    syncStatuses(clientMessageIds: string[]): Promise<{
        clientMessageId: string;
        status: import("./schemas/message.schema").MessageStatus;
    }[]>;
    createGroup(creatorPhoneNumber: string, creatorId: string, dto: CreateGroupDto): Promise<ChatRoomDocument>;
    addParticipants(requesterPhoneNumber: string, roomId: string, dto: AddParticipantsDto): Promise<ChatRoomDocument>;
    removeParticipant(requesterPhoneNumber: string, roomId: string, dto: RemoveParticipantDto): Promise<ChatRoomDocument>;
    leaveGroup(requesterPhoneNumber: string, requesterUserId: string, roomId: string): Promise<{
        message: string;
        newAdmin: string | null;
    }>;
    updateGroup(requesterPhoneNumber: string, roomId: string, dto: {
        name?: string;
        avatarUrl?: string;
    }): Promise<ChatRoomDocument>;
    blockUser(userId: string, targetId: string): Promise<{
        message: string;
    }>;
    unblockUser(userId: string, targetId: string): Promise<{
        message: string;
    }>;
    getBlockList(userId: string): Promise<Types.ObjectId[]>;
    isBlocked(senderId: string, recipientId: string): Promise<boolean>;
    private findGroupOrFail;
    private assertIsAdmin;
    private resolvePhoneNumbersToObjectIds;
    getMessageByClientId(clientMessageId: string): Promise<MessageDocument | null>;
    softDeleteMessage(clientMessageId: string): Promise<void>;
}
