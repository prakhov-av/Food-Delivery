import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../../orders/validation/order-limits';

/**
   * Описывает структуру данных «OrderItemUpdateDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class OrderItemUpdateDto {
  @ApiProperty({ maximum: MAX_QUANTITY_PER_ITEM })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  newQuantity: number;
}
