import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class SyncContactsDto {
  /**
   * Array of phone numbers read from the device's contact list.
   * The backend will return which of these belong to registered app users.
   */
  @IsArray({ message: 'phoneNumbers must be an array.' })
  @ArrayMinSize(1, { message: 'phoneNumbers must contain at least 1 number.' })
  @IsString({ each: true, message: 'Each phone number must be a string.' })
  phoneNumbers: string[];
}
