import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
export declare class UsersService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
    create(createData: Partial<User>): Promise<UserDocument>;
    findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null>;
    findById(id: string): Promise<UserDocument | null>;
    updateRefreshToken(id: string, refreshToken: string | null): Promise<void>;
    updateLocation(userId: string, lng: number, lat: number): Promise<void>;
    getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number): Promise<(import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
