import { VideoService } from './video.service';
export declare class VideoController {
    private readonly videoService;
    constructor(videoService: VideoService);
    joinRoom(roomId: string, req: any): Promise<{
        token: string;
    }>;
}
