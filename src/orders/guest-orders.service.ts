import { Injectable } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { Order } from './order.entity';
import { OrderDto } from './dto/order.dto';
import { CLOSED_STATUSES } from './enums/status.enum';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { OrderItem } from '../order-items/order-item.entity';
import { OrderItemLine, OrderWithItems } from './types/order-with-items';

/**
 * Обеспечивает доступ гостевых сессий к собственным заказам.
 *
 * Все запросы ограничиваются идентификатором гостевой сессии.
 */
@Injectable()
export class GuestOrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly mapper: OrdersMapper,
  ) {}

  /**
   * Возвращает активные заказы гостевой сессии.
   */
  async getGuestOrders(guestSessionId: string): Promise<OrderDto[]> {
    const orders: Order[] =
      await this.repository.findActiveByGuestSessionId(guestSessionId);

    if (orders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(orders);
  }

  /**
   * Возвращает незакрытые заказы гостевой сессии.
   */
  async getCurrentGuestOrders(guestSessionId: string): Promise<OrderDto[]> {
    const orders: Order[] =
      await this.repository.findActiveByGuestSessionId(guestSessionId);

    const currentOrders: Order[] = orders.filter(
      (order: Order): boolean => !CLOSED_STATUSES.includes(order.status),
    );

    if (currentOrders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(currentOrders);
  }

  /**
   * Возвращает заказ и его активные позиции,
   * если заказ принадлежит указанной гостевой сессии.
   */
  async getGuestOrderWithItemsById(
    orderId: number,
    guestSessionId: string,
  ): Promise<OrderWithItems> {
    const order: Order | null =
      await this.repository.findActiveByIdForGuestSession(
        orderId,
        guestSessionId,
      );

    if (!order) {
      throw new EntityNotFoundException(Order.name, orderId);
    }

    const items: OrderItem[] = await this.repository.findActiveItemsByOrderId(
      order.id,
    );

    return {
      order: this.mapper.mapEntityToDto(order),
      items: items.map((item: OrderItem): OrderItemLine => ({
        name: item.menuItem.name,
        quantity: item.quantity,
      })),
    };
  }
}
