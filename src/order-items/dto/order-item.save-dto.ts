import { ApiProperty } from '@nestjs/swagger';

export class OrderItemSaveDto {
  @ApiProperty()
  orderId: number;

  @ApiProperty()
  menuItemId: number;

  @ApiProperty()
  quantity: number;
}
