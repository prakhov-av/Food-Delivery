import { Injectable } from '@nestjs/common';
import { Order } from '../order.entity';
import { OrderDto } from './order.dto';
import { OrderSaveDto } from './order.save-dto';
import { Status } from '../enums/status.enum';

@Injectable()
export class OrdersMapper {
  mapEntityToDto(entity: Order): OrderDto {
    if (!entity) {
      return new OrderDto();
    }

    const dto: OrderDto = new OrderDto();
    dto.id = entity.id;
    dto.customer = entity.customer;
    dto.courier = entity.courier;
    dto.restaurant = entity.restaurant;
    dto.status = entity.status;
    dto.totalPrice = entity.totalPrice;
    dto.createdAt = entity.createdAt;
    return dto;
  }

  mapDtoToEntity(_saveDto: OrderSaveDto): Order {
    const entity = new Order();
    return entity;
  }

  mapEntityListToDtoList(entityList: Order[]): OrderDto[] {
    return entityList.map((o: Order): OrderDto => this.mapEntityToDto(o));
  }
}
