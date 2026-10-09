import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { In, Repository } from 'typeorm';
import { Status } from './enums/status.enum';
import { OrderItem } from '../order-items/order-item.entity';

/**
   * Инкапсулирует операции доступа к данным соответствующего доменного ресурса.
   */
@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly repository: Repository<Order>,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(order: Order): Promise<Order> {
    return this.repository.save(order);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findById(id: number): Promise<Order | null> {
    return this.repository.findOneBy({ id });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findByIdWithRelations(id: number): Promise<Order | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findActiveDraft(
    customerId: number,
    restaurantId: number,
  ): Promise<Order | null> {
    return this.repository.findOne({
      where: {
        active: true,
        status: Status.NEW,
        customer: { id: customerId },
        restaurant: { id: restaurantId },
      },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActive(): Promise<Order[]> {
    return this.repository.find({
      where: { active: true },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async countActiveItems(orderId: number): Promise<number> {
    return this.repository.manager.count(OrderItem, {
      where: { order: { id: orderId }, active: true },
    });
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async countSubmittedByCustomerId(customerId: number): Promise<number> {
    return this.repository.count({
      where: {
        active: true,
        customer: { id: customerId },
        status: In([
          Status.ACCEPTED,
          Status.COOKING,
          Status.READY,
          Status.DELIVERING,
        ]),
      },
    });
  }
}