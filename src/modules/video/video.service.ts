import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class VideoService {
  constructor(private configService: ConfigService) {}

  async generateRoomToken(userId: string, userName: string, roomName: string): Promise<string> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: userName, // Highly cached real name optimized dynamically over token metadata
    });

    // Provide strict WebRTC joining scopes guaranteeing precise capability locks
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return await at.toJwt();
  }
}
