import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class SyncStatusesDto {
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    clientMessageIds: string[];
}
