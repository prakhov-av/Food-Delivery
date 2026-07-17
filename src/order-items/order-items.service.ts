import { Injectable } from '@nestjs/common';
import { Order } from '../orders/order.entity';
import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrdersService } from '../orders/orders.service';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItemDto } from './dto/order-item.dto';
import { OrderItem } from './order-item.entity';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';
import { MenuItemsService } from '../menu-items/menu-items.service';

@Injectable()
export class OrderItemsService {
  constructor(
    private readonly repository: OrderItemsRepository,
    private readonly mapper: OrderItemsMapper,
    private readonly ordersService: OrdersService,
    private readonly menuItemsService: MenuItemsService,
  ) {}

  async create(saveDto: OrderItemSaveDto): Promise<OrderItemDto> {
    const entity: OrderItem = this.mapper.mapDtoToEntity(saveDto);
    const order: Order = await this.ordersService.getEntityById(
      saveDto.orderId,
    );
    entity.order = order;
    entity.menuItem = await this.menuItemsService.getActiveEntityById(
      saveDto.menuItemId,
    );
    await this.repository.save(entity);
    return this.mapper.mapEntityToDto(entity);
  }

  async getAll(): Promise<OrderItemDto[]> {
    const orderItems: OrderItem[] = await this.repository.findAll();
    return this.mapper.mapEntityListToDtoList(orderItems);
  }

  async getById(id: number): Promise<OrderItemDto> {
    const orderItem: OrderItem = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(orderItem);
  }

  async getActiveEntityById(id: number): Promise<OrderItem> {
    const orderItem: OrderItem | null = await this.repository.findById(id);

    if (!orderItem) {
      throw Error('Order item not found');
    }

    return orderItem;
  }

  async update(id: number, updateItemDto: OrderItemUpdateDto): Promise<void> {
    const foundOrderItem = await this.getActiveEntityById(id);

    if (foundOrderItem) {
      foundOrderItem.quantity = updateItemDto.quantity;
      await this.repository.save(foundOrderItem);
    }
  }

  async deleteById(id: number): Promise<void> {
    await this.getActiveEntityById(id);
    await this.repository.deleteById(id);
  }
}
