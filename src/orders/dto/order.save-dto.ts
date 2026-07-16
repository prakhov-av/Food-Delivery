import { ApiProperty } from '@nestjs/swagger';

export class OrderSaveDto {
  @ApiProperty()
  customerId: number;

  @ApiProperty()
  restaurantId: number;
}
