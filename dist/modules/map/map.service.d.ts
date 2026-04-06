import { UsersService } from '../users/users.service';
export declare class MapService {
    private readonly usersService;
    constructor(usersService: UsersService);
    updateLocation(userId: string, lng: number, lat: number): Promise<void>;
    getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number): Promise<(import("mongoose").Document<unknown, {}, import("../users/schemas/user.schema").UserDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schemas/user.schema").User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
