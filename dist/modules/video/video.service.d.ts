import { ConfigService } from '@nestjs/config';
export declare class VideoService {
    private configService;
    constructor(configService: ConfigService);
    generateRoomToken(userId: string, userName: string, roomName: string): Promise<string>;
}
