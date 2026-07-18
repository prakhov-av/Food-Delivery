import { ApiProperty } from '@nestjs/swagger';
import { Min } from 'class-validator';

export class OrderItemUpdateDto {
  @ApiProperty()
  @Min(1)
  newQuantity: number;
}
