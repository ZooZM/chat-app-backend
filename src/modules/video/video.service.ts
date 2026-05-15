import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { ChatRoomsRepository } from '../chat/chat-rooms.repository';

@Injectable()
export class VideoService {
  constructor(
    private configService: ConfigService,
    private chatRoomsRepository: ChatRoomsRepository,
  ) {}

  async generateRoomToken(userId: string, userName: string, roomId: string): Promise<string> {
    // INV-9: verify the caller is a participant of this ChatRoom before issuing token.
    // Skip the check for legacy 1-to-1 rooms that follow the "call_A_B" naming pattern.
    const isLegacyCallRoom = roomId.startsWith('call_');
    if (!isLegacyCallRoom) {
      const room = await this.chatRoomsRepository.findOne({
        _id: roomId,
        participants: userId,
      });
      if (!room) {
        throw new ForbiddenException('You are not a participant of this room.');
      }
    }

    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    const at = new AccessToken(apiKey, apiSecret, {
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
}
