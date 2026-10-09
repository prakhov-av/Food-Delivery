import { Injectable, Logger } from '@nestjs/common';

import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { OrderSaveDto } from './dto/order.save-dto';
import { OrderDto } from './dto/order.dto';
import { Order } from './order.entity';
import {
  CANCELLED_STATUSES,
  CLOSED_STATUSES,
  Status,
} from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';

import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.enums';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { Role } from '../users/enums/role.enum';
import { RoleMismatchException } from '../exceptions/types/role-mismatch.exception';

import { User } from '../users/user.entity';

import { checkOrderStatusChange } from './validation/order-status-change';
import { checkOrderAccess } from './validation/order-access';

import { MAX_SUBMITTED_ORDERS_PER_CUSTOMER } from './validation/order-limits';

/**
   * Реализует жизненный цикл заказов и применяет правила доступа, ограничения и допустимые переходы статусов.
   */
@Injectable()
export class OrdersService {
  private readonly logger: Logger = new Logger(OrdersService.name);

  constructor(
    private readonly repository: OrdersRepository,
    private readonly mapper: OrdersMapper,
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async create(saveDto: OrderSaveDto, user: User): Promise<OrderDto> {
    const draft: Order | null = await this.repository.findActiveDraft(
      user.id,
      saveDto.restaurantId,
    );

    if (draft) {
      return this.mapper.mapEntityToDto(draft);
    }

    const entity: Order = this.mapper.mapDtoToEntity(saveDto);

    entity.customer = user;

    entity.restaurant = await this.restaurantsService.getActiveEntityById(
      saveDto.restaurantId,
    );

    entity.courier = null;
    entity.status = Status.NEW;
    entity.active = true;
    entity.totalPrice = 0;

    await this.repository.save(entity);

    this.logger.log(
      `Order created: id ${entity.id}, ` +
        `customer id ${entity.customer.id}, ` +
        `courier id not assigned, ` +
        `restaurant id ${entity.restaurant.id}`,
    );

    await this.audit.record({
      action: AuditAction.ORDER_CREATED,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Order',
      entityId: entity.id,
      details: {
        restaurantId: entity.restaurant.id,
      },
    });

    return this.mapper.mapEntityToDto(entity);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getAllOrders(user: Pick<User, 'id' | 'role'>): Promise<OrderDto[]> {
    const orders: Order[] = await this.repository.findAllActive();

    if (orders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    let accessibleOrders: Order[];

    if (user.role === Role.ADMIN || user.role === Role.MANAGER) {
      accessibleOrders = orders;
    } else if (user.role === Role.CUSTOMER) {
      accessibleOrders = orders.filter(
        (order: Order): boolean => order.customer.id === user.id,
      );
    } else if (user.role === Role.COURIER) {
      accessibleOrders = orders.filter(
        (order: Order): boolean => order.courier?.id === user.id,
      );
    } else {
      accessibleOrders = [];
    }

    if (accessibleOrders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(accessibleOrders);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getCurrentOrders(user: Pick<User, 'id' | 'role'>): Promise<OrderDto[]> {
    const orders: OrderDto[] = await this.getAllOrders(user);

    const currentOrders: OrderDto[] = orders.filter(
      (order: OrderDto): boolean =>
        order.status === undefined || !CLOSED_STATUSES.includes(order.status),
    );

    if (currentOrders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return currentOrders;
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getOrderById(id: number, user: User): Promise<OrderDto> {
    const order: Order = await this.getActiveEntityById(id);

    checkOrderAccess(order, user);

    return this.mapper.mapEntityToDto(order);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getActiveEntityById(id: number): Promise<Order> {
    const order: Order | null = await this.repository.findByIdWithRelations(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    return order;
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getActiveEntityByIdWithRelations(id: number): Promise<Order> {
    const order: Order | null = await this.repository.findByIdWithRelations(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    return order;
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getOrderByIdWithRelations(
    id: number,
    user: Pick<User, 'id' | 'role'>,
  ): Promise<OrderDto> {
    const order: Order | null = await this.repository.findByIdWithRelations(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    checkOrderAccess(order, user);

    return this.mapper.mapEntityToDto(order);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getActiveOrderByIdWithRelations(id: number): Promise<OrderDto> {
    const order: Order | null = await this.repository.findByIdWithRelations(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    return this.mapper.mapEntityToDto(order);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async update(id: number, updateDto: OrderUpdateDto): Promise<void> {
    const order: Order = await this.getActiveEntityById(id);

    if (CLOSED_STATUSES.includes(order.status)) {
      const state: string =
        order.status === Status.COMPLETED ? 'completed' : 'cancelled';

      throw new EntityUpdateException(
        `Order id ${id} is already ${state} and cannot be updated`,
      );
    }

    if (updateDto.courierId === undefined) {
      throw new EntityUpdateException('Courier id must be specified');
    }

    const courier: User = await this.usersService.getActiveEntityById(
      updateDto.courierId,
    );

    if (courier.role !== Role.COURIER) {
      throw new RoleMismatchException(updateDto.courierId, Role.COURIER);
    }

    order.courier = courier;

    await this.repository.save(order);

    this.logger.log(
      `Order updated: id ${id}, ` +
        `new courier ${order.courier.id}, ` +
        `status ${order.status}`,
    );
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(id: number): Promise<void> {
    const order: Order = await this.getActiveEntityById(id);

    order.active = false;

    await this.repository.save(order);

    this.logger.log(`Order marked as inactive: id ${id}`);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async restoreById(id: number): Promise<void> {
    const order: Order | null = await this.repository.findById(id);

    if (!order) {
      throw new EntityNotFoundException(Order.name, id);
    }

    if (!order.active) {
      order.active = true;

      await this.repository.save(order);

      this.logger.log(`Order marked as active: id ${id}`);
    }
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async updateTotalPrice(id: number, totalPrice: number): Promise<void> {
    const order: Order = await this.getActiveEntityById(id);

    order.totalPrice = totalPrice;

    await this.repository.save(order);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async setStatus(id: number, status: Status, user: User): Promise<void> {
    const order: Order = await this.getActiveEntityById(id);

    if (order.status === status) {
      throw new EntityUpdateException(
        `Order id ${id} already has status ${status}`,
      );
    }

    checkOrderAccess(order, user);

    checkOrderStatusChange(order.status, status, user.role);

    /**
   * Выход из NEW в любой статус, кроме отмены
   * (в том числе принудительно администратором).
   * Заказ должен содержать хотя бы одну позицию,
   * и у клиента не должно быть слишком много активных заказов.
   */
    if (order.status === Status.NEW && !CANCELLED_STATUSES.includes(status)) {
      const activeItems: number = await this.repository.countActiveItems(
        order.id,
      );

      if (activeItems === 0) {
        throw new EntityUpdateException(
          `Order id ${id} is empty and cannot be accepted`,
        );
      }

      const submitted: number =
        await this.repository.countSubmittedByCustomerId(order.customer.id);

      if (submitted >= MAX_SUBMITTED_ORDERS_PER_CUSTOMER) {
        throw new EntityUpdateException(
          `Customer id ${order.customer.id} cannot have more than ${MAX_SUBMITTED_ORDERS_PER_CUSTOMER} active orders`,
        );
      }
    }

    const previousStatus: Status = order.status;

    order.status = status;

    let autoAssignedCourierId: number | null = null;

    /**
   * READY: автоматически назначаем свободного курьера.
   * Если свободного курьера нет, заказ остаётся READY без курьера,
   * менеджер или администратор назначает его вручную.
   */
    if (status === Status.READY && !order.courier) {
      this.logger.log(`Trying to find available courier for order id ${id}`);

      const courier: User | null =
        await this.usersService.findAvailableCourier();

      if (courier) {
        order.courier = courier;
        autoAssignedCourierId = courier.id;

        this.logger.log(
          `Courier automatically assigned: ` +
            `order id ${id}, ` +
            `courier id ${courier.id}`,
        );
      } else {
        this.logger.warn(`No available courier found for order id ${id}`);
      }
    }

    await this.repository.save(order);

    this.logger.log(
      `Order status changed: id ${id}, ` +
        `status ${status}, ` +
        `user id ${user.id}, ` +
        `role ${user.role}`,
    );

    await this.audit.record({
      action: AuditAction.ORDER_STATUS_CHANGED,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'Order',
      entityId: id,
      details: {
        from: previousStatus,
        to: status,
      },
    });

    if (autoAssignedCourierId !== null) {
      await this.audit.record({
        action: AuditAction.ORDER_COURIER_ASSIGNED,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Order',
        entityId: id,
        details: {
          courierId: autoAssignedCourierId,
          mode: 'AUTO',
        },
      });
    }
  }
}
