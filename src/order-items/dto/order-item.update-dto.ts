import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../../orders/validation/order-limits';

export class OrderItemUpdateDto {
  @ApiProperty({ maximum: MAX_QUANTITY_PER_ITEM })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  newQuantity: number;
}
