import { Injectable } from '@nestjs/common';
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

    const order: OrderDto =
      await this.ordersService.getActiveOrderByIdWithRelations(orderId);

    if (!this.canAccessOrder(order, userId, userRole)) {
      throw new EntityNotFoundException('Order', orderId);
    }

    return this.formatOrderData(order);
  }

  private canAccessOrder(
    order: OrderDto,
    userId: number,
    userRole: Role,
  ): boolean {
    if (userRole === Role.ADMIN || userRole === Role.MANAGER) {
      return true;
    }

    if (userRole === Role.CUSTOMER) {
      return order.customer.id === userId;
    }

    if (userRole === Role.COURIER) {
      return order.courier?.id === userId;
    }

    return false;
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
