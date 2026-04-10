import { IsString, IsNotEmpty, IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;

  @ValidateIf((o) => !o.phoneNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
