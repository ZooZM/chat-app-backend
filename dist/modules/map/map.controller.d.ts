import { MapService } from './map.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { NearbyUsersDto } from './dto/nearby-users.dto';
export declare class MapController {
    private readonly mapService;
    constructor(mapService: MapService);
    updateLocation(req: any, updateLocationDto: UpdateLocationDto): Promise<{
        message: string;
    }>;
    getNearbyUsers(req: any, query: NearbyUsersDto): Promise<{
        users: (import("mongoose").Document<unknown, {}, import("../users/schemas/user.schema").UserDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schemas/user.schema").User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
}
