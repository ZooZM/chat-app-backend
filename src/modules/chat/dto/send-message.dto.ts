import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsMongoId()
  chatRoomId: string;

  @IsNotEmpty()
  @IsString()
  content: string;
}
