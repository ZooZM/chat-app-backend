import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  IsPhoneNumber,
  IsOptional,
  IsUrl,
  IsMongoId,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Phone numbers of initial participants (creator is added automatically).
   * Must have at least 1 other participant.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'A group must have at least 1 other participant.' })
  @IsString({ each: true })
  participants: string[];

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class AddParticipantsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Provide at least 1 phone number to add.' })
  @IsString({ each: true })
  phoneNumbersToAdd: string[];
}

export class RemoveParticipantDto {
  @IsString()
  @IsNotEmpty()
  phoneNumberToRemove: string;
}
