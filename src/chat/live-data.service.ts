import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/user.entity';
import { OrderDto } from '../orders/dto/order.dto';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { ChatClassification } from './types/chat-classification';
import { LiveDataResource } from './enums/live-data-resource.enum';
import { DocumentType } from '../ingestion/enums/document-type.enum';

@Injectable()
export class LiveDataService {
  constructor(private readonly ordersService: OrdersService) {}

  async getLiveData(
    classification: ChatClassification,
    userId: number,
    userRole: Role,
  ): Promise<string> {
    if (
      classification.documentType !== DocumentType.ORDER ||
      classification.resource !== LiveDataResource.ORDER
    ) {
      return 'Для ответа на этот вопрос необходимы актуальные данные системы.';
    }

    const user: Pick<User, 'id' | 'role'> = {
      id: userId,
      role: userRole,
    };

    if (classification.resourceId === undefined) {
      try {
        const orders: OrderDto[] =
          await this.ordersService.getCurrentOrders(user);

        return this.formatOrdersData(orders);
      } catch (error) {
        if (error instanceof EntityNotFoundException) {
          return this.formatNoOrdersMessage(userRole);
        }

        throw error;
      }
    }

    try {
      const order: OrderDto =
        await this.ordersService.getOrderByIdWithRelations(
          classification.resourceId,
          user,
        );

      return this.formatOrderData(order);
    } catch (error) {
      if (
        error instanceof EntityNotFoundException ||
        error instanceof ForbiddenException
      ) {
        return this.formatNoOrdersMessage(userRole, classification.resourceId);
      }

      throw error;
    }
  }

  private formatOrdersData(orders: OrderDto[]): string {
    return orders
      .map((order: OrderDto): string => this.formatOrderData(order))
      .join('\n\n');
  }

  private formatNoOrdersMessage(userRole: Role, orderId?: number): string {
    if (orderId !== undefined) {
      if (userRole === Role.COURIER) {
        return `У вас нет заказа №${orderId} на выполнение.`;
      }

      if (userRole === Role.CUSTOMER) {
        return `У вас нет заказа №${orderId} среди ваших заказов.`;
      }

      return `Заказ №${orderId} не найден.`;
    }

    if (userRole === Role.COURIER) {
      return 'У вас нет заказов на выполнение.';
    }

    if (userRole === Role.CUSTOMER) {
      return 'У вас нет заказов.';
    }

    return 'В системе нет доступных заказов.';
  }

  private formatOrderData(order: OrderDto): string {
    return [
      `Заказ №${order.id}`,
      `Статус: ${order.status ?? 'не указан'}`,
      `Сумма: ${order.totalPrice}`,
      `Ресторан: ${order.restaurant.name}`,
      `Клиент: ${order.customer.name}`,
      `Курьер: ${order.courier?.name ?? 'не назначен'}`,
      `Создан: ${order.createdAt.toISOString()}`,
    ].join('\n');
  }
}
