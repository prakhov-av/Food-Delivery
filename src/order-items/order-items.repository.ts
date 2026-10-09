import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderItem } from './order-item.entity';

/**
   * Инкапсулирует операции доступа к данным соответствующего доменного ресурса.
   */
@Injectable()
export class OrderItemsRepository {
  constructor(
    @InjectRepository(OrderItem)
    private readonly repository: Repository<OrderItem>,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(orderItem: OrderItem): Promise<OrderItem> {
    return this.repository.save(orderItem);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActive(): Promise<OrderItem[]> {
    return this.repository.find({
      where: {
        active: true,
      },
      relations: {
        menuItem: true,
        order: {
          customer: true,
          courier: true,
        },
      },
    });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findById(id: number): Promise<OrderItem | null> {
    return this.repository.findOne({
      where: {
        id,
      },
      relations: {
        menuItem: true,
        order: {
          customer: true,
          courier: true,
        },
      },
    });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActiveByOrderId(orderId: number): Promise<OrderItem[]> {
    return this.repository.find({
      where: {
        active: true,
        order: {
          id: orderId,
        },
      },
      relations: {
        menuItem: true,
      },
    });
  }
}
