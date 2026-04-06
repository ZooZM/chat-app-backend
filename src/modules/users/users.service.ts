import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createData: Partial<User>): Promise<UserDocument> {
    try {
      const existingUser = await this.userModel.findOne({ phoneNumber: createData.phoneNumber });
      if (existingUser) {
        throw new ConflictException('User with this phone number already exists');
      }

      let hashedPassword;
      if (createData.password) {
        hashedPassword = await bcrypt.hash(createData.password, 10);
      }

      const newUser = new this.userModel({
        ...createData,
        ...(hashedPassword && { password: hashedPassword }),
      });

      return await newUser.save();
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Error creating user');
    }
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { refreshToken }).exec();
  }
}
