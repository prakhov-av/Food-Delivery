import { ApiProperty } from '@nestjs/swagger';
import { Min } from 'class-validator';

export class OrderItemSaveDto {
  @ApiProperty()
  @Min(1)
  orderId: number;

  @ApiProperty()
  @Min(1)
  menuItemId: number;

  @ApiProperty()
  @Min(1)
  quantity: number;
}
