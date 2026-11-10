import { ApiProperty } from '@nestjs/swagger';

import { OrderDto } from './order.dto';
import { OrderItemDto } from '../../order-items/dto/order-item.dto';

/**
 * Заказ гостевой сессии вместе с его активными позициями.
 *
 * Отдельная структура нужна, потому что гость не является пользователем:
 * в заказе нет customer, а позиции нужны интерфейсу для показа корзины.
 */
export class GuestOrderDto {
  @ApiProperty({ type: OrderDto })
  order: OrderDto;

  @ApiProperty({ type: OrderItemDto, isArray: true })
  items: OrderItemDto[];
}
