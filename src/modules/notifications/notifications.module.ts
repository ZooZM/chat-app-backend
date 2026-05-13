import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeviceToken, DeviceTokenSchema } from './device-token.schema';
import { DeviceTokensRepository } from './device-tokens.repository';
import { PushService } from './push.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeviceToken.name, schema: DeviceTokenSchema }]),
  ],
  providers: [DeviceTokensRepository, PushService],
  exports: [PushService, DeviceTokensRepository],
})
export class NotificationsModule {}
