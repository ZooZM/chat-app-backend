import { IsNotEmpty, IsString } from 'class-validator';

export class RejectCallDto {
  @IsString()
  @IsNotEmpty()
  callerId: string;
}
