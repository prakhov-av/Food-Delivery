import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
   * Описывает структуру данных «OrderUpdateDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class OrderUpdateDto {
  @ApiProperty({
    required: false,
    description: 'ID курьера для ручного назначения или замены',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  courierId?: number;
}
