import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SyncContactsDto } from './dto/sync-contacts.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users/sync-contacts
   *
   * Accepts a list of phone numbers from the device's contact book.
   * Returns only the subset of those numbers that are registered app users,
   * with safe public profile fields only.
   *
   * Protected: requires a valid JWT (logged-in users only).
   */
  @UseGuards(JwtAuthGuard)
  @Post('sync-contacts')
  @HttpCode(HttpStatus.OK)
  async syncContacts(@Request() req: any, @Body() dto: SyncContactsDto) {
    const registeredContacts = await this.usersService.syncContacts(dto.phoneNumbers);

    return {
      message: `Found ${registeredContacts.length} registered contact(s).`,
      data: registeredContacts,
    };
  }
}
