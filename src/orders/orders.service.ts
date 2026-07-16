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

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly mapper: OrdersMapper,
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async create(saveDto: OrderSaveDto): Promise<OrderDto> {
    const entity: Order = this.mapper.mapDtoToEntity(saveDto);
    entity.status = Status.CREATED;
    entity.customer = await this.usersService.getActiveEntityById(
      saveDto.customerId,
    );
    entity.restaurant = await this.restaurantsService.getActiveEntityById(
      saveDto.restaurantId,
    );
    await this.repository.save(entity);
    return this.mapper.mapEntityToDto(entity);
  }

  async getAllOrders(): Promise<OrderDto[]> {
    const orders: Order[] = await this.repository.findAll();
    return this.mapper.mapEntityListToDtoList(orders);
  }

  async getOrderById(id: number): Promise<OrderDto> {
    const order: Order = await this.getEntityById(id);
    return this.mapper.mapEntityToDto(order);
  }

  async getEntityById(id: number): Promise<Order> {
    const order: Order | null = await this.repository.findById(id);

    if (!order) {
      throw Error();
    }

    return order;
  }

  async update(id: number, updateDto: OrderUpdateDto): Promise<void> {
    const order = await this.getEntityById(id);

    order.status = updateDto.status;

    if (updateDto.courierId) {
      order.courier = await this.usersService.getActiveEntityById(
        updateDto.courierId,
      );
    }

    await this.repository.save(order);
  }

  async setStatus(id: number, status: Status): Promise<void> {
    const order: Order = await this.getEntityById(id);
    order.status = status;
    await this.repository.save(order);
  }
}
