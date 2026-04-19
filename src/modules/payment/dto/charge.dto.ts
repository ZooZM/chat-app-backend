import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateIf, Length, IsEmail, IsOptional } from 'class-validator';

export enum PaymentMethod {
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export class ChargeDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  // Direct Card fields - STRICTLY validated if paymentMethod is CARD
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @IsNotEmpty()
  pan?: string;

  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  cvv?: string;

  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  expiryMonth?: string;

  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @IsNotEmpty()
  @Length(2, 4)
  expiryYear?: string;

  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @IsString()
  @IsNotEmpty()
  cardholder?: string;

  // Wallet fields - Apple/Google Pay tokens
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.WALLET)
  @IsString()
  @IsNotEmpty()
  walletToken?: string;
}
