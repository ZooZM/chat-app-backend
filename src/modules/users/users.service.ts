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

  async updateLocation(userId: string, lng: number, lat: number): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        },
      },
    ).exec();
  }

  async getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number) {
    const maxDistanceMeters = maxDistanceKm * 1000;

    return this.userModel.find({
      _id: { $ne: userId }, // Exclude self
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    })
    .select('_id name location isOnline')
    .exec();
  }
}

