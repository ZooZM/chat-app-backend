import { Controller, Get, Patch, Body, Query, UseGuards, Request } from '@nestjs/common';
import { MapService } from './map.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { NearbyUsersDto } from './dto/nearby-users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Patch('location')
  async updateLocation(@Request() req: any, @Body() updateLocationDto: UpdateLocationDto) {
    const { userId } = req.user;
    const { longitude, latitude } = updateLocationDto;
    
    await this.mapService.updateLocation(userId, longitude, latitude);
    
    return { message: 'Location updated successfully' };
  }

  @Get('nearby')
  async getNearbyUsers(@Request() req: any, @Query() query: NearbyUsersDto) {
    const { userId } = req.user;
    const { longitude, latitude, radius } = query;
    
    const users = await this.mapService.getNearbyUsers(userId, longitude, latitude, radius || 10);
    
    return { users };
  }
}
