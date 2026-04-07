import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository extends BaseRepository<UserDocument> {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {
    super(userModel);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.findOne({ phoneNumber });
  }

  async getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number) {
    const maxDistanceMeters = maxDistanceKm * 1000;

    return this.userModel.find({
      _id: { $ne: userId },
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
