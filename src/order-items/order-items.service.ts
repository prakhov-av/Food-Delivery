import { Injectable, Logger } from '@nestjs/common';
import { Order } from '../orders/order.entity';
import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrdersService } from '../orders/orders.service';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItemDto } from './dto/order-item.dto';
import { OrderItem } from './order-item.entity';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';
import { MenuItemsService } from '../menu-items/menu-items.service';
// import { OrderItemsValidator } from './validation/order-items.validator';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

@Injectable()
export class OrderItemsService {
  private readonly logger: Logger = new Logger(OrderItemsService.name);

  constructor(
    private readonly repository: OrderItemsRepository,
    private readonly mapper: OrderItemsMapper,
    private readonly ordersService: OrdersService,
    private readonly menuItemsService: MenuItemsService,
    // private readonly validator: OrderItemsValidator,
  ) {}

  async create(saveDto: OrderItemSaveDto): Promise<OrderItemDto> {
    // this.validator.validateSaveDto(saveDto);
    const entity: OrderItem = this.mapper.mapDtoToEntity(saveDto);
    const order: Order = await this.ordersService.getActiveEntityById(
      saveDto.orderId,
    );
    entity.order = order;
    entity.active = true;
    entity.menuItem = await this.menuItemsService.getActiveEntityById(
      saveDto.menuItemId,
    );
    await this.repository.save(entity);

    this.logger.log(
      `Order item created: id ${entity.id}, order id ${entity.order.id}, menu item id ${entity.menuItem.id}`,
    );

    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveOrderItems(): Promise<OrderItemDto[]> {
    const orderItems: OrderItem[] = await this.repository.findAllActive();

    if (orderItems.length === 0) {
      throw new EntityNotFoundException(OrderItem.name);
    }

    return this.mapper.mapEntityListToDtoList(orderItems);
  }

  async getActiveOrderItemById(id: number): Promise<OrderItemDto> {
    const orderItem: OrderItem = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(orderItem);
  }

  async getActiveEntityById(id: number): Promise<OrderItem> {
    const orderItem: OrderItem | null = await this.repository.findById(id);

    if (!orderItem || !orderItem.active) {
      throw new EntityNotFoundException(OrderItem.name, id);
    }

    return orderItem;
  }

  async update(id: number, updateItemDto: OrderItemUpdateDto): Promise<void> {
    // this.validator.validateUpdateDto(updateItemDto);
    const foundOrderItem: OrderItem = await this.getActiveEntityById(id);

    foundOrderItem.quantity = updateItemDto.newQuantity;
    await this.repository.save(foundOrderItem);

    this.logger.log(
      `Order item updated: id ${id}, new quantity ${foundOrderItem.quantity}`,
    );
  }

  async deleteById(id: number): Promise<void> {
    const orderItem: OrderItem = await this.getActiveEntityById(id);
    orderItem.active = false;
    await this.repository.save(orderItem);

    this.logger.log(`Order item marked as inactive: id ${id}`);
  }

  async restoreById(id: number): Promise<void> {
    const orderItem: OrderItem | null = await this.repository.findById(id);

    if (!orderItem) {
      throw new EntityNotFoundException(OrderItem.name, id);
    }

    if (!orderItem.active) {
      orderItem.active = true;
      await this.repository.save(orderItem);

      this.logger.log(`Order item marked as active: id ${id}`);
    }
  }
}
