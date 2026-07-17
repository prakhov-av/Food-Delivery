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
    dto.customer = this.usersMapper.mapEntityToDto(entity.customer);
    dto.courier = this.usersMapper.mapEntityToDto(entity.courier);
    dto.restaurant = this.restaurantsMapper.mapEntityToDto(entity.restaurant);
    dto.status = entity.status;
    dto.totalPrice = entity.totalPrice;
    dto.createdAt = entity.createdAt;
    return dto;
  }

  mapDtoToEntity(saveDto: OrderSaveDto): Order {
    const entity = new Order();
    return entity;
  }

  mapEntityListToDtoList(entityList: Order[]): OrderDto[] {
    return entityList.map((o: Order): OrderDto => this.mapEntityToDto(o));
  }
}
