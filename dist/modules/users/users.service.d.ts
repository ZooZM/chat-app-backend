import { User, UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository: UsersRepository);
    create(createData: Partial<User>): Promise<UserDocument>;
    findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null>;
    findByEmail(email: string): Promise<UserDocument | null>;
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
    syncContacts(phoneNumbers: string[]): Promise<Partial<UserDocument>[]>;
    updateOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
}
