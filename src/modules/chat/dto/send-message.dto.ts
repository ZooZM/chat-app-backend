import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsEnum,
  IsObject,
  IsUrl,
} from 'class-validator';
import { MessageType } from '../schemas/message.schema';

export class SendMessageDto {
  @IsNotEmpty()
  @IsMongoId()
  chatRoomId: string;

  /**
   * Text body. Optional for file/image/voice messages where content can be
   * an empty string or a caption. Required only for text type.
   */
  @IsOptional()
  @IsString()
  content?: string;

  @IsNotEmpty()
  @IsString()
  clientMessageId: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  /**
   * Relative URL returned by POST /chat/upload.
   * Must be present for image, file, and voice_note types.
   */
  @IsOptional()
  @IsString()
  fileUrl?: string;

  /**
   * Flexible metadata bag:
   *   { fileName, fileSize, mimeType }  for image/file
   *   { contactName, contactPhone }     for contact
   *   { duration }                      for voice_note
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
