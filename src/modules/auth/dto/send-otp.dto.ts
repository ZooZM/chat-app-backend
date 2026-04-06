import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;
}
