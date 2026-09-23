import { Injectable, Logger } from '@nestjs/common';

import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { OrderSaveDto } from './dto/order.save-dto';
import { OrderDto } from './dto/order.dto';
import { Order } from './order.entity';
import { Status } from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';

import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { Role } from '../users/enums/role.enum';
import { RoleMismatchException } from '../exceptions/types/role-mismatch.exception';

import { User } from '../users/user.entity';

import { checkOrderStatusChange } from './validation/order-status-change';
import { checkOrderAccess } from './validation/order-access';

@Injectable()
export class OrdersService {
  private readonly logger: Logger = new Logger(OrdersService.name);

  constructor(
    private readonly repository: OrdersRepository,
    private readonly mapper: OrdersMapper,
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async create(saveDto: OrderSaveDto, user: User): Promise<OrderDto> {
    const entity: Order = this.mapper.mapDtoToEntity(saveDto);

    entity.customer = user;

    entity.restaurant = await this.restaurantsService.getActiveEntityById(
      saveDto.restaurantId,
    );

    entity.courier = await this.usersService.getActiveEntityById(
      saveDto.courierId,
    );

    if (entity.courier.role !== Role.COURIER) {
      throw new RoleMismatchException(saveDto.courierId, Role.COURIER);
    }

    entity.status = Status.NEW;
    entity.active = true;
    entity.totalPrice = 0;

    await this.repository.save(entity);

    this.logger.log(
      `Order created: id ${entity.id}, ` +
        `customer id ${entity.customer.id}, ` +
        `courier id ${entity.courier.id}, ` +
        `restaurant id ${entity.restaurant.id}`,
    );

    return this.mapper.mapEntityToDto(entity);
  }

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
        (order) => order.customer.id === user.id,
      );
    } else if (user.role === Role.COURIER) {
      accessibleOrders = orders.filter(
        (order) => order.courier?.id === user.id,
      );
    } else {
      accessibleOrders = [];
    }

    if (accessibleOrders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(accessibleOrders);
  }

  async getCurrentOrders(user: Pick<User, 'id' | 'role'>): Promise<OrderDto[]> {
    const orders: OrderDto[] = await this.getAllOrders(user);

    const currentOrders: OrderDto[] = orders.filter(
      (order: OrderDto): boolean =>
        order.status !== Status.COMPLETED &&
        order.status !== Status.CANCELLED_CUSTOMER &&
        order.status !== Status.CANCELLED_COURIER,
    );

    if (currentOrders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return currentOrders;
  }

  /**
   * Получение одного заказа.
   */
  async getOrderById(id: number, user: User): Promise<OrderDto> {
    const order = await this.getActiveEntityById(id);

    checkOrderAccess(order, user);

    return this.mapper.mapEntityToDto(order);
  }

  async getActiveEntityById(id: number): Promise<Order> {
    const order: Order | null = await this.repository.findById(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    return order;
  }

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

  async getActiveOrderByIdWithRelations(id: number): Promise<OrderDto> {
    const order: Order | null = await this.repository.findByIdWithRelations(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    return this.mapper.mapEntityToDto(order);
  }

  async update(id: number, updateDto: OrderUpdateDto): Promise<void> {
    const order = await this.getActiveEntityById(id);

    if (updateDto.courierId !== undefined) {
      const courier = await this.usersService.getActiveEntityById(
        updateDto.courierId,
      );

      if (courier.role !== Role.COURIER) {
        throw new RoleMismatchException(updateDto.courierId, Role.COURIER);
      }

      order.courier = courier;

      await this.repository.save(order);

      this.logger.log(
        `Order updated: id ${id}, ` + `new courier ${order.courier.id}`,
      );
    }
  }

  async deleteById(id: number): Promise<void> {
    const order = await this.getActiveEntityById(id);

    order.active = false;

    await this.repository.save(order);

    this.logger.log(`Order marked as inactive: id ${id}`);
  }

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

  async setStatus(id: number, status: Status, user: User): Promise<void> {
    const order = await this.getActiveEntityById(id);

    if (order.status === status) {
      throw new EntityUpdateException(
        `Order id ${id} already has status ${status}`,
      );
    }

    checkOrderAccess(order, user);

    checkOrderStatusChange(order.status, status, user.role);

    order.status = status;

    await this.repository.save(order);

    this.logger.log(
      `Order status changed: id ${id}, ` +
        `status ${status}, ` +
        `user id ${user.id}, ` +
        `role ${user.role}`,
    );
  }
}
