import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptCallDto {
  @IsString()
  @IsNotEmpty()
  callerId: string;
}
