import { IsString, IsNotEmpty, IsMongoId, IsOptional, IsArray } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsMongoId()
  chatRoomId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsString()
  clientMessageId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messageIds?: string[];

  @IsNotEmpty()
  @IsString()
  type: string;
}
