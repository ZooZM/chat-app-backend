import { Model } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { User, UserDocument } from './schemas/user.schema';
export declare class UsersRepository extends BaseRepository<UserDocument> {
    private readonly userModel;
    constructor(userModel: Model<UserDocument>);
    findById(id: string): Promise<UserDocument | null>;
    findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null>;
    getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number): Promise<(import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
