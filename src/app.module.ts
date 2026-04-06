import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './modules/redis/redis.module';
import { ChatModule } from './modules/chat/chat.module';
import { VideoModule } from './modules/video/video.module';
import { MapModule } from './modules/map/map.module';
import * as Joi from 'joi';

@Module({
  imports: [
    // Configure Environment Variables Globally
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        MONGODB_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        LIVEKIT_API_KEY: Joi.string().required(),
        LIVEKIT_API_SECRET: Joi.string().required(),
        LIVEKIT_WS_URL: Joi.string().required(),
      }),
    }),
    
    // Configure MongoDB Connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),

    // Application Modules
    UsersModule,
    AuthModule,
    RedisModule,
    ChatModule,
    VideoModule,
    MapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
