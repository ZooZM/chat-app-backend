import { IsString, IsNotEmpty, IsOptional, MinLength, IsEmail, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;

  @ValidateIf((o) => !o.phoneNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
