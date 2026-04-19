import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) { }

  async create(createData: Partial<User>): Promise<UserDocument> {
    try {
      const existingUser = await this.usersRepository.findByPhoneNumber(createData.phoneNumber as string);
      if (existingUser) {
        throw new ConflictException('User with this phone number already exists');
      }

      let hashedPassword;
      if (createData.password) {
        hashedPassword = await bcrypt.hash(createData.password, 10);
      }

      const newUser = await this.usersRepository.create({
        ...createData,
        ...(hashedPassword && { password: hashedPassword }),
      });

      return newUser;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Error creating user');
    }
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.usersRepository.findByPhoneNumber(phoneNumber);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findOne({ email } as any);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.usersRepository.findById(id);
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    await this.usersRepository.updateOne({ _id: id } as any, { refreshToken });
  }

  async updateLocation(userId: string, lng: number, lat: number): Promise<void> {
    await this.usersRepository.updateOne(
      { _id: userId } as any,
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        },
      },
    );
  }

  async getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number) {
    return this.usersRepository.getNearbyUsers(userId, lng, lat, maxDistanceKm);
  }

  /**
   * Given a list of phone numbers from the device contact list,
   * returns only those that are registered users in the app.
   * Only safe public fields are returned (no password, no tokens).
   */
  async syncContacts(phoneNumbers: string[]) {
    return this.usersRepository.findByPhoneNumbers(phoneNumbers);
  }

  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await this.usersRepository.updateOne({ _id: userId } as any, { isOnline });
    const user = await this.usersRepository.findById(userId);
    console.log(`User ${userId} is ${user?.isOnline}`);
  }
}
