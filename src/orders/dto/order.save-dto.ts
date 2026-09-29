import { ApiProperty } from '@nestjs/swagger';
import { Min } from 'class-validator';

export class OrderSaveDto {
  @ApiProperty()
  @Min(1)
  customerId: number;

  @ApiProperty()
  @Min(1)
  restaurantId: number;
}
