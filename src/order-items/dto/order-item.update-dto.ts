import { ApiProperty } from '@nestjs/swagger';

export class OrderItemUpdateDto {
  @ApiProperty()
  quantity: number;
}
