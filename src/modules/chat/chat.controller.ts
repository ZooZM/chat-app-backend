import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateGroupDto, AddParticipantsDto, RemoveParticipantDto } from './dto/group.dto';
import { ResolvePrivateChatDto } from './dto/resolve-private-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // Room & Message Queries
  // ─────────────────────────────────────────────────────────────────────────────

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

  /**
   * POST /chat/private/resolve
   *
   * The Flutter app calls this when a user taps a contact to start chatting.
   * It finds an existing 1-on-1 room, or creates one if none exists.
   * Returns the roomId which the app uses to navigate to the chat screen.
   */
  @Post('private/resolve')
  @HttpCode(HttpStatus.OK)
  async resolvePrivateChat(@Request() req: any, @Body() dto: ResolvePrivateChatDto) {
    const { roomId, room } = await this.chatService.resolvePrivateRoom(
      req.user.userId,
      dto.userId,
    );
    return { roomId, room };
  }

  @Post('messages/sync-statuses')
  @HttpCode(HttpStatus.OK)
  async syncStatuses(@Body() dto: { clientMessageIds: string[] }) {
    return this.chatService.syncStatuses(dto.clientMessageIds);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Group Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /chat/group/create
   * Creates a new group chat. The authenticated user becomes the first admin.
   */
  @Post('group/create')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@Request() req: any, @Body() dto: CreateGroupDto) {
    const { userId, phoneNumber } = req.user;
    const group = await this.chatService.createGroup(phoneNumber, userId, dto);
    return {
      message: `Group "${dto.name}" created successfully.`,
      data: group,
    };
  }

  /**
   * POST /chat/group/:roomId/add
   * Adds one or more participants to the group. Requester must be an admin.
   */
  @Post('group/:roomId/add')
  @HttpCode(HttpStatus.OK)
  async addParticipants(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: AddParticipantsDto,
  ) {
    const { phoneNumber } = req.user;
    const updated = await this.chatService.addParticipants(phoneNumber, roomId, dto);
    return {
      message: `${dto.phoneNumbersToAdd.length} participant(s) added.`,
      data: updated,
    };
  }

  /**
   * POST /chat/group/:roomId/remove
   * Removes a participant from the group. Requester must be an admin.
   */
  @Post('group/:roomId/remove')
  @HttpCode(HttpStatus.OK)
  async removeParticipant(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: RemoveParticipantDto,
  ) {
    const { phoneNumber } = req.user;
    const updated = await this.chatService.removeParticipant(phoneNumber, roomId, dto);
    return {
      message: `${dto.phoneNumberToRemove} has been removed from the group.`,
      data: updated,
    };
  }

  /**
   * POST /chat/group/:roomId/leave
   * Removes the authenticated user from the group.
   * If they are the last admin, another participant is promoted automatically.
   */
  @Post('group/:roomId/leave')
  @HttpCode(HttpStatus.OK)
  async leaveGroup(@Request() req: any, @Param('roomId') roomId: string) {
    const { userId, phoneNumber } = req.user;
    return this.chatService.leaveGroup(phoneNumber, userId, roomId);
  }
}
