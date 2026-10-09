import { ApiProperty } from '@nestjs/swagger';
import { Min } from 'class-validator';

/**
   * Описывает структуру данных «OrderSaveDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class OrderSaveDto {
  @ApiProperty()
  @Min(1)
  customerId: number;

  @ApiProperty()
  @Min(1)
  restaurantId: number;
}
