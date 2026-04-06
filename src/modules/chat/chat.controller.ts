import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async getUserRooms(
    @Request() req: any,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    const l = limit ? parseInt(limit.toString(), 10) : 20;
    return this.chatService.getUserRooms(req.user.userId, l, cursor);
  }

  @Get('rooms/:roomId/messages')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    const l = limit ? parseInt(limit.toString(), 10) : 50;
    return this.chatService.getRoomMessages(roomId, l, cursor);
  }
}
