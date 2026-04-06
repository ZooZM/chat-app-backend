import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class MapService {
  constructor(private readonly usersService: UsersService) {}

  async updateLocation(userId: string, lng: number, lat: number) {
    return this.usersService.updateLocation(userId, lng, lat);
  }

  async getNearbyUsers(userId: string, lng: number, lat: number, maxDistanceKm: number) {
    return this.usersService.getNearbyUsers(userId, lng, lat, maxDistanceKm);
  }
}
