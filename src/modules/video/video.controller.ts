import { Controller, Post, Param, UseGuards, Request } from '@nestjs/common';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('room/:roomId/join')
  async joinRoom(@Param('roomId') roomId: string, @Request() req: any) {
    // Dynamically parsing out from validated payload safely and effortlessly
    const { userId, name } = req.user;
    
    const token = await this.videoService.generateRoomToken(userId, name, roomId);
    
    return { token };
  }
}
