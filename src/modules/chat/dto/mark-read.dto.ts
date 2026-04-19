import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class MarkReadDto {
    @IsNotEmpty()
    @IsString()
    chatRoomId: string;

    @IsOptional()
    @IsString()
    messageId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    messageIds?: string[];
}