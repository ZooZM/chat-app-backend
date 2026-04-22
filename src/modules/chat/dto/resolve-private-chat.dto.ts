import { IsString, IsNotEmpty } from 'class-validator';

export class ResolvePrivateChatDto {
  /**
   * The phone number of the user you want to start a chat with.
   */
  @IsString()
  @IsNotEmpty()
  userId: string;
}
