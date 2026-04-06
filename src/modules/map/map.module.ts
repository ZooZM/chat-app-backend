import { Module } from '@nestjs/common';
import { MapService } from './map.service';
import { MapController } from './map.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], // Strictly importing the existing data layer
  providers: [MapService],
  controllers: [MapController],
})
export class MapModule {}
