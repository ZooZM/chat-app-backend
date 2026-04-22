import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class MarkDeliveredDto {
    @IsNotEmpty()
    @IsString()
    chatRoomId: string;

    @IsOptional()
    @IsString()
    clientMessageId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    clientMessageIds?: string[];
}
