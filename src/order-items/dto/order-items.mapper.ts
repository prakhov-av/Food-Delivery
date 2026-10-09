import { Injectable } from '@nestjs/common';
import { OrderItem } from '../order-item.entity';
import { OrderItemDto } from './order-item.dto';
import { OrderItemSaveDto } from './order-item.save-dto';
import { MenuItemsMapper } from '../../menu-items/dto/menu-items.mapper';

/**
   * Описывает структуру данных «OrderItemsMapper», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
@Injectable()
export class OrderItemsMapper {
  constructor(private readonly menuItemsMapper: MenuItemsMapper) {}

  mapEntityToDto(entity: OrderItem): OrderItemDto {
    if (!entity) {
      return new OrderItemDto();
    }

    const dto: OrderItemDto = new OrderItemDto();
    dto.id = entity.id;
    dto.orderId = entity.order?.id;
    dto.menuItem = this.menuItemsMapper.mapEntityToDto(entity.menuItem);
    dto.quantity = entity.quantity;
    return dto;
  }

  mapDtoToEntity(saveDto: OrderItemSaveDto): OrderItem {
    const entity: OrderItem = new OrderItem();
    entity.quantity = saveDto.quantity;
    return entity;
  }

  mapEntityListToDtoList(entityList: OrderItem[]): OrderItemDto[] {
    return entityList.map((o: OrderItem): OrderItemDto =>
      this.mapEntityToDto(o),
    );
  }
}
