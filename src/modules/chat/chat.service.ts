import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatRoomDocument, ChatRoomType } from './schemas/chat-room.schema';
import { MessageDocument, MessageType } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateGroupDto, AddParticipantsDto, RemoveParticipantDto } from './dto/group.dto';
import { ChatRoomsRepository } from './chat-rooms.repository';
import { MessagesRepository } from './messages.repository';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRoomsRepository: ChatRoomsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly usersRepository: UsersRepository,
  ) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Rooms
  // ─────────────────────────────────────────────────────────────────────────────

  async createPrivateRoom(userA: string, userB: string): Promise<ChatRoomDocument> {
    const existing = await this.chatRoomsRepository.findPrivateRoom(userA, userB);
    if (existing) return existing;

    const participants = [new Types.ObjectId(userA), new Types.ObjectId(userB)];
    return this.chatRoomsRepository.create({ type: 'PRIVATE', participants });
  }

  /**
   * Resolves (finds or creates) a private 1-on-1 chat room between the requester
   * and a target user identified by phone number. Safe to call multiple times —
   * returns the same room if one already exists.
   */
  async resolvePrivateRoom(
    requesterId: string,
    targetUserId: string,
  ): Promise<{ roomId: string; room: ChatRoomDocument }> {
    // 1. Look up target user by phone number
    const targetUser = await this.usersRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException(`User with ID "${targetUserId}" is not registered.`);
    }

    const targetId = targetUser._id.toString();

    if (targetId === requesterId) {
      throw new BadRequestException('You cannot start a chat with yourself.');
    }

    // 2. Find existing private room or create a new one
    let room = await this.chatRoomsRepository.findPrivateRoom(requesterId, targetId);
    if (!room) {
      const participants = [new Types.ObjectId(requesterId), new Types.ObjectId(targetId)];
      room = await this.chatRoomsRepository.create({ type: ChatRoomType.PRIVATE, participants });
    }

    return { roomId: room._id.toString(), room };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────────────────────────────────────

  async saveMessage(
    senderId: string,
    payload: SendMessageDto,
  ): Promise<{ message: MessageDocument; isNew: boolean }> {
    const room = await this.chatRoomsRepository.findById(payload.chatRoomId);
    if (!room) throw new NotFoundException('Chat room not found');

    // ── Idempotency guard ────────────────────────────────────────────────────
    // If this clientMessageId already exists in MongoDB the client is retrying
    // after a lost acknowledgment. Return the existing document without saving
    // or broadcasting again — the gateway will still emit messageSent so the
    // client knows the ACK was received.
    if (payload.clientMessageId) {
      const existing = await this.messagesRepository.findByClientMessageId(
        payload.clientMessageId,
      );
      if (existing) {
        return { message: existing, isNew: false };
      }
    }

    const savedMessage = await this.messagesRepository.create({
      chatRoomId: new Types.ObjectId(payload.chatRoomId),
      senderId: new Types.ObjectId(senderId),
      content: payload.content ?? '',
      clientMessageId: payload.clientMessageId,
      messageType: payload.type ?? MessageType.TEXT,
      fileUrl: payload.fileUrl,
      metadata: payload.metadata,
    });

    await this.chatRoomsRepository.updateLastMessage(
      payload.chatRoomId,
      savedMessage._id.toString(),
    );

    return { message: savedMessage, isNew: true };
  }

  /** Saves a SYSTEM message (e.g. "User X created the group"). No sender. */
  private async saveSystemMessage(roomId: string, content: string): Promise<void> {
    const message = await this.messagesRepository.create({
      chatRoomId: new Types.ObjectId(roomId),
      senderId: new Types.ObjectId('000000000000000000000000'), // sentinel ObjectId for system
      content,
      messageType: MessageType.SYSTEM,
    });
    await this.chatRoomsRepository.updateLastMessage(roomId, message._id.toString());
  }

  async getUserRooms(userId: string, limit = 20, cursor?: string) {
    return this.chatRoomsRepository.getUserRooms(userId, limit, cursor);
  }

  /** Lightweight version for the WS Gateway — only fetches _id fields. */
  async getUserRoomsForSocket(userId: string) {
    return this.chatRoomsRepository.getUserRoomIds(userId);
  }

  async getRoomMessages(roomId: string, limit = 50, cursor?: string) {
    return this.messagesRepository.getRoomMessages(roomId, limit, cursor);
  }

  /** Appends the reader's phoneNumber to `readBy` on each message (idempotent via $addToSet). */
  async markMessagesRead(userId: string, roomId: string, messageIds: string[]) {
    // SECURITY CHECK: التأكد إن اليوزر مشارك فعلي في الغرفة
    const room = await this.chatRoomsRepository.findOne({
      _id: roomId,
      participants: userId,
    });

    if (!room) {
      throw new ForbiddenException('Unauthorized to read messages in this room');
    }

    return this.messagesRepository.markRead(messageIds, userId);
  }

  async markMessagesDelivered(userId: string, roomId: string, messageIds: string[]) {
    const room = await this.chatRoomsRepository.findOne({
      _id: roomId,
      participants: userId,
    });

    if (!room) {
      throw new ForbiddenException('Unauthorized to mark messages as delivered in this room');
    }

    return this.messagesRepository.markDelivered(messageIds, userId);
  }

  async syncStatuses(clientMessageIds: string[]) {
    return this.messagesRepository.fetchStatusesByClientIds(clientMessageIds);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Group Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a GROUP chat room. The creator is automatically added as both
   * a participant and the first admin.
   */
  async createGroup(
    creatorPhoneNumber: string,
    creatorId: string,
    dto: CreateGroupDto,
  ): Promise<ChatRoomDocument> {
    // Resolve all participant phone numbers → ObjectIds (excluding creator, handled separately)
    const participantIds = await this.resolvePhoneNumbersToObjectIds([
      creatorPhoneNumber,
      ...dto.participants,
    ]);

    const room = await this.chatRoomsRepository.create({
      type: ChatRoomType.GROUP,
      name: dto.name,
      avatarUrl: dto.avatarUrl,
      participants: participantIds,
      admins: [creatorPhoneNumber], // Creator is the first admin (stored by phone number)
    });

    await this.saveSystemMessage(
      room._id.toString(),
      `${creatorPhoneNumber} created the group "${dto.name}"`,
    );

    return room;
  }

  /**
   * Adds new participants to a group. Requester must be an admin.
   */
  async addParticipants(
    requesterPhoneNumber: string,
    roomId: string,
    dto: AddParticipantsDto,
  ): Promise<ChatRoomDocument> {
    const room = await this.findGroupOrFail(roomId);
    this.assertIsAdmin(room, requesterPhoneNumber);

    const newUserIds = await this.resolvePhoneNumbersToObjectIds(dto.phoneNumbersToAdd);
    const updated = await this.chatRoomsRepository.addParticipants(roomId, newUserIds);

    const addedList = dto.phoneNumbersToAdd.join(', ');
    await this.saveSystemMessage(roomId, `${requesterPhoneNumber} added ${addedList}`);

    return updated!;
  }

  /**
   * Removes a participant from a group. Requester must be an admin.
   * Admins cannot remove themselves via this method (use leaveGroup instead).
   */
  async removeParticipant(
    requesterPhoneNumber: string,
    roomId: string,
    dto: RemoveParticipantDto,
  ): Promise<ChatRoomDocument> {
    const room = await this.findGroupOrFail(roomId);
    this.assertIsAdmin(room, requesterPhoneNumber);

    if (dto.phoneNumberToRemove === requesterPhoneNumber) {
      throw new BadRequestException('Admins cannot remove themselves. Use the /leave endpoint instead.');
    }

    const targetUser = await this.usersRepository.findByPhoneNumber(dto.phoneNumberToRemove);
    if (!targetUser) throw new NotFoundException(`User "${dto.phoneNumberToRemove}" not found.`);

    const updated = await this.chatRoomsRepository.removeParticipant(roomId, targetUser._id);

    // If the removed user was also an admin, strip that too
    if (room.admins.includes(dto.phoneNumberToRemove)) {
      await this.chatRoomsRepository.removeAdmin(roomId, dto.phoneNumberToRemove);
    }

    await this.saveSystemMessage(roomId, `${requesterPhoneNumber} removed ${dto.phoneNumberToRemove}`);

    return updated!;
  }

  /**
   * Removes the requester from the group. If they are the last admin, randomly
   * promotes another participant to admin before leaving.
   */
  async leaveGroup(requesterPhoneNumber: string, requesterUserId: string, roomId: string): Promise<{ message: string }> {
    const room = await this.findGroupOrFail(roomId);

    const isAdmin = room.admins.includes(requesterPhoneNumber);
    const isLastAdmin = isAdmin && room.admins.length === 1;

    if (isLastAdmin) {
      // Find the remaining participants (excluding self) to promote
      const otherParticipants = (room.participants as any[]).filter(
        (p) => p.toString() !== requesterUserId,
      );

      if (otherParticipants.length === 0) {
        // Last person in the group — just remove and leave room empty
      } else {
        // Promote a random other participant by fetching their phone number
        const randomIndex = Math.floor(Math.random() * otherParticipants.length);
        const promotedId = otherParticipants[randomIndex].toString();
        const promotedUser = await this.usersRepository.findById(promotedId);

        if (promotedUser) {
          await this.chatRoomsRepository.addAdmin(roomId, promotedUser.phoneNumber);
          await this.saveSystemMessage(
            roomId,
            `${promotedUser.phoneNumber} is now an admin (${requesterPhoneNumber} left the group)`,
          );
        }
      }

      // Strip self from admins
      await this.chatRoomsRepository.removeAdmin(roomId, requesterPhoneNumber);
    } else {
      await this.saveSystemMessage(roomId, `${requesterPhoneNumber} left the group`);
    }

    // Remove from participants
    const user = await this.usersRepository.findById(requesterUserId);
    if (user) {
      await this.chatRoomsRepository.removeParticipant(roomId, user._id);
    }

    return { message: 'You have left the group.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /** Finds a GROUP room or throws a 404. */
  private async findGroupOrFail(roomId: string): Promise<ChatRoomDocument> {
    const room = await this.chatRoomsRepository.findById(roomId);
    if (!room) throw new NotFoundException('Chat room not found.');
    if (room.type !== ChatRoomType.GROUP) throw new BadRequestException('This operation is only valid for group chats.');
    return room;
  }

  /** Throws 403 if the given phoneNumber is not in the room's admins array. */
  private assertIsAdmin(room: ChatRoomDocument, phoneNumber: string): void {
    if (!room.admins.includes(phoneNumber)) {
      throw new ForbiddenException('Only group admins can perform this action.');
    }
  }

  /**
   * Resolves an array of phone numbers to MongoDB ObjectIds.
   * Throws a 404 if any phone number is not found in the DB.
   */
  private async resolvePhoneNumbersToObjectIds(phoneNumbers: string[]): Promise<Types.ObjectId[]> {
    const uniqueNumbers = [...new Set(phoneNumbers)];
    const objectIds: Types.ObjectId[] = [];

    for (const phone of uniqueNumbers) {
      const user = await this.usersRepository.findByPhoneNumber(phone);
      if (!user) throw new NotFoundException(`User with phone number "${phone}" not found.`);
      objectIds.push(user._id);
    }

    return objectIds;
  }
}
