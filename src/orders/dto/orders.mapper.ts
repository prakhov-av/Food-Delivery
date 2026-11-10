import { Injectable } from '@nestjs/common';
import { Order } from '../order.entity';
import { OrderDto } from './order.dto';
import { OrderSaveDto } from './order.save-dto';
import { UsersMapper } from '../../users/dto/users.mapper';
import { RestaurantsMapper } from '../../restaurants/dto/restaurants.mapper';

@Injectable()
export class OrdersMapper {
  constructor(
    private readonly usersMapper: UsersMapper,
    private readonly restaurantsMapper: RestaurantsMapper,
  ) {}

  mapEntityToDto(entity: Order): OrderDto {
    if (!entity) {
      return new OrderDto();
    }

    const dto: OrderDto = new OrderDto();
    dto.id = entity.id;
    dto.customer = entity.customer
      ? this.usersMapper.mapEntityToDto(entity.customer)
      : null;
    dto.courier = entity.courier
      ? this.usersMapper.mapEntityToDto(entity.courier)
      : null;
    dto.restaurant = this.restaurantsMapper.mapEntityToDto(entity.restaurant);
    dto.status = entity.status;
    dto.totalPrice = entity.totalPrice;
    dto.createdAt = entity.createdAt;

    return dto;
  }

  mapDtoToEntity(_saveDto: OrderSaveDto): Order {
    return new Order();
  }

  mapEntityListToDtoList(entityList: Order[]): OrderDto[] {
    return entityList.map((order: Order): OrderDto =>
      this.mapEntityToDto(order),
    );
  }
}
