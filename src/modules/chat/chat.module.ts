import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ChatRoom, ChatRoomSchema } from './schemas/chat-room.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { JwtModule } from '@nestjs/jwt';
import { ChatRoomsRepository } from './chat-rooms.repository';
import { MessagesRepository } from './messages.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    AuthModule, // Enables importing passport strategies / general auth config
    JwtModule, // Assuming JwtModule was exported natively by AuthModule, but adding explicitly safely if needed
  ],
  providers: [ChatService, ChatGateway, ChatRoomsRepository, MessagesRepository],
  exports: [ChatService, ChatRoomsRepository, MessagesRepository],
  controllers: [ChatController],
})
export class ChatModule {}
