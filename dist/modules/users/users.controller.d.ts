import { UsersService } from './users.service';
import { SyncContactsDto } from './dto/sync-contacts.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    syncContacts(req: any, dto: SyncContactsDto): Promise<{
        message: string;
        data: Partial<import("./schemas/user.schema").UserDocument>[];
    }>;
}
