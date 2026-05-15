import { ConfigService } from '@nestjs/config';
import { ChatRoomsRepository } from '../chat/chat-rooms.repository';
export declare class VideoService {
    private configService;
    private chatRoomsRepository;
    constructor(configService: ConfigService, chatRoomsRepository: ChatRoomsRepository);
    generateRoomToken(userId: string, userName: string, roomId: string): Promise<string>;
}
