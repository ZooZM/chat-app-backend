import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
export declare class UsersService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
    create(createData: Partial<User>): Promise<UserDocument>;
    findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null>;
    findById(id: string): Promise<UserDocument | null>;
    updateRefreshToken(id: string, refreshToken: string | null): Promise<void>;
}
