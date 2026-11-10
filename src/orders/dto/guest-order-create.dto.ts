import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * Запрос на создание или получение черновика заказа гостя.
 */
export class GuestOrderCreateDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  restaurantId: number;
}
