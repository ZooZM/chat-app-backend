import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class RequestCallDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @IsBoolean()
  @IsNotEmpty()
  isVideo: boolean;
}
