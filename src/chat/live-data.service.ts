import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { Role } from '../users/enums/role.enum';
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
      classification.resource !== LiveDataResource.ORDER ||
      classification.resourceId === undefined
    ) {
      return 'Для ответа на этот вопрос необходимы актуальные данные системы.';
    }

    const orderId: number = classification.resourceId;

    try {
      const order: OrderDto =
        await this.ordersService.getOrderByIdWithRelations(orderId, {
          id: userId,
          role: userRole,
        });

      return this.formatOrderData(order);
    } catch (error: unknown) {
      if (
        error instanceof EntityNotFoundException ||
        error instanceof ForbiddenException
      ) {
        return this.formatOrderAccessMessage(orderId, userRole);
      }

      throw error;
    }
  }

  private formatOrderData(order: OrderDto): string {
    return [
      `Заказ №${order.id}`,
      `Статус: ${order.status ?? 'не указан'}`,
      `Сумма: ${order.totalPrice}`,
      `Ресторан: ${order.restaurant.name}`,
      `Пользователь: ${order.customer.name}`,
      `Курьер: ${order.courier?.name ?? 'не назначен'}`,
      `Создан: ${order.createdAt.toISOString()}`,
    ].join('\n');
  }

  private formatOrderAccessMessage(orderId: number, userRole: Role): string {
    if (userRole === Role.COURIER) {
      return `У вас нет заказа №${orderId} на выполнение.`;
    }

    if (userRole === Role.CUSTOMER) {
      return `У вас нет заказа №${orderId} среди ваших заказов.`;
    }

    return `Заказ №${orderId} не найден.`;
  }
}
