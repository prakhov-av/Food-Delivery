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
   * Сохраняет заказ.
   */
  async save(order: Order): Promise<Order> {
    return this.repository.save(order);
  }

  /**
   * Находит заказ по идентификатору.
   */
  async findById(id: number): Promise<Order | null> {
    return this.repository.findOneBy({ id });
  }

  /**
   * Находит заказ по идентификатору вместе со связанными сущностями.
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
   * Находит активный черновик зарегистрированного пользователя.
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
   * Возвращает все активные заказы.
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
   * Находит активный черновик гостевой сессии в ресторане.
   */
  async findActiveDraftForGuest(
    guestSessionId: string,
    restaurantId: number,
  ): Promise<Order | null> {
    return this.repository.findOne({
      where: {
        active: true,
        status: Status.NEW,
        guestSession: { id: guestSessionId },
        restaurant: { id: restaurantId },
      },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
        guestSession: true,
      },
    });
  }

  /**
   * Возвращает активные заказы конкретной гостевой сессии.
   *
   * Фильтрация выполняется на уровне базы данных.
   */
  async findActiveByGuestSessionId(guestSessionId: string): Promise<Order[]> {
    return this.repository.find({
      where: {
        active: true,
        guestSession: { id: guestSessionId },
      },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
        guestSession: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Возвращает активный заказ, принадлежащий конкретной гостевой сессии.
   *
   * Одновременно проверяет идентификатор заказа и владельца.
   */
  async findActiveByIdForGuestSession(
    orderId: number,
    guestSessionId: string,
  ): Promise<Order | null> {
    return this.repository.findOne({
      where: {
        id: orderId,
        active: true,
        guestSession: { id: guestSessionId },
      },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
        guestSession: true,
      },
    });
  }

  /**
   * Возвращает количество активных заказов гостевой сессии.
   */
  async countActiveByGuestSessionId(guestSessionId: string): Promise<number> {
    return this.repository.count({
      where: {
        active: true,
        guestSession: { id: guestSessionId },
      },
    });
  }

  /**
   * Возвращает количество активных позиций заказа.
   */
  async countActiveItems(orderId: number): Promise<number> {
    return this.repository.manager.count(OrderItem, {
      where: { order: { id: orderId }, active: true },
    });
  }

  /**
   * Возвращает активные позиции заказа.
   */
  async findActiveItemsByOrderId(orderId: number): Promise<OrderItem[]> {
    return this.repository.manager.find(OrderItem, {
      where: { order: { id: orderId }, active: true },
      relations: { menuItem: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Возвращает количество активных заказов клиента,
   * находящихся в процессе выполнения.
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
