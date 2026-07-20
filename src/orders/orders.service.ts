import { Injectable } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { OrderSaveDto } from './dto/order.save-dto';
import { OrderDto } from './dto/order.dto';
import { Order } from './order.entity';
import { Status } from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { OrdersValidator } from './validation/orders.validator';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly mapper: OrdersMapper,
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly validator: OrdersValidator,
  ) {}

  async create(saveDto: OrderSaveDto): Promise<OrderDto> {
    this.validator.validateSaveDto(saveDto);
    const entity: Order = this.mapper.mapDtoToEntity(saveDto);
    entity.customer = await this.usersService.getActiveEntityById(
      saveDto.customerId,
    );
    entity.restaurant = await this.restaurantsService.getActiveEntityById(
      saveDto.restaurantId,
    );
    entity.status = Status.NEW;
    await this.repository.save(entity);
    return this.mapper.mapEntityToDto(entity);
  }

  async getAllOrders(): Promise<OrderDto[]> {
    const orders: Order[] = await this.repository.findAllActive();

    if (orders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(orders);
  }

  async getOrderById(id: number): Promise<OrderDto> {
    const order: Order = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(order);
  }

  async getActiveEntityById(id: number): Promise<Order> {
    const order: Order | null = await this.repository.findById(id);

    if (!order || !order.active) {
      throw new EntityNotFoundException(Order.name, id);
    }

    return order;
  }

  async update(id: number, updateDto: OrderUpdateDto): Promise<void> {
    this.validator.validateUpdateDto(updateDto);
    const order: Order = await this.getActiveEntityById(id);

    order.status = updateDto.status;

    if (updateDto.courierId !== undefined) {
      order.courier = await this.usersService.getActiveEntityById(
        updateDto.courierId,
      );
    }

    await this.repository.save(order);
  }

  async deleteById(id: number): Promise<void> {
    const order: Order = await this.getActiveEntityById(id);
    order.active = false;
    await this.repository.save(order);
  }

  async restoreById(id: number): Promise<void> {
    const order: Order | null = await this.repository.findById(id);

    if (!order) {
      throw new EntityNotFoundException(Order.name, id);
    }

    if (!order.active) {
      order.active = true;
      await this.repository.save(order);
    }
  }

  async setStatus(id: number, status: Status): Promise<void> {
    const order: Order = await this.getActiveEntityById(id);

    if (order.status === status) {
      throw new EntityUpdateException(
        `Order id ${id} already has status ${status}`,
      );
    }

    order.status = status;
    await this.repository.save(order);
  }
}
