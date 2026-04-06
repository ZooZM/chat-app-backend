import { IsNumber, Min, Max } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;
}
