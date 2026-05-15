import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateGroupDto, AddParticipantsDto, RemoveParticipantDto } from './dto/group.dto';
import { ResolvePrivateChatDto } from './dto/resolve-private-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) { }

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

  /**
   * POST /chat/upload
   *
   * Accepts a single file (image, audio, document) via multipart/form-data.
   * The file is saved to /uploads on disk and served as a static asset.
   *
   * Flutter flow:
   *   1. Call this endpoint FIRST to get a fileUrl.
   *   2. Emit the sendMessage socket event with type + fileUrl + metadata.
   *
   * Returns: { fileUrl: '/uploads/<uuid>.<ext>', fileName, fileSize, mimeType }
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB hard cap
      fileFilter: (_req, file, cb) => {
        // Allow: images, audio, video, pdf, office docs, plain text
        const allowed = /^(image|audio|video)\/.+$|application\/(pdf|msword|vnd\.openxmlformats|octet-stream)|text\/.+/;
        if (allowed.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return {
      fileUrl:  `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Block Management
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('block/:targetId')
  @HttpCode(HttpStatus.OK)
  async blockUser(@Request() req: any, @Param('targetId') targetId: string) {
    return this.chatService.blockUser(req.user.userId, targetId);
  }

  @Delete('block/:targetId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(@Request() req: any, @Param('targetId') targetId: string) {
    return this.chatService.unblockUser(req.user.userId, targetId);
  }

  @Get('block-list')
  async getBlockList(@Request() req: any) {
    return this.chatService.getBlockList(req.user.userId);
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

    // Notify the other participants (creator already has the room in their
    // response). The gateway also joins their live sockets to the new room
    // so subsequent messages arrive immediately.
    const otherParticipantIds = (group.participants as any[])
      .map((p) => (p?._id ?? p)?.toString?.() ?? String(p))
      .filter((id) => id && id !== userId);

    if (otherParticipantIds.length > 0) {
      await this.chatGateway.broadcastNewChatRoom(
        otherParticipantIds,
        group._id.toString(),
        { room: group },
      );
    }

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

  /**
   * PATCH /chat/group/:roomId
   * Admin-only: update group name and/or avatar URL.
   * On success, emits `chatRoomUpdated` to all room participants via socket.
   */
  @Patch('group/:roomId')
  @HttpCode(HttpStatus.OK)
  async updateGroup(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: { name?: string; avatarUrl?: string },
  ) {
    const { phoneNumber } = req.user;
    const updated = await this.chatService.updateGroup(phoneNumber, roomId, dto);
    this.chatGateway.broadcastRoomUpdated(roomId, {
      roomId,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    });
    return updated;
  }
}
