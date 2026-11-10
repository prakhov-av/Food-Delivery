import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../validation/order-limits';

/**
 * Запрос на добавление позиции в заказ гостя.
 */
export class GuestOrderItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  menuItemId: number;

  @ApiProperty({ maximum: MAX_QUANTITY_PER_ITEM })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity: number;
}
