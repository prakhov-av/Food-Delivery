import { Injectable, Logger } from '@nestjs/common';

import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItemDto } from './dto/order-item.dto';
import { OrderItem } from './order-item.entity';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';

import { OrdersService } from '../orders/orders.service';
import { MenuItemsService } from '../menu-items/menu-items.service';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { checkOrderAccess } from '../orders/validation/order-access';

@Injectable()
export class OrderItemsService {
  private readonly logger: Logger = new Logger(OrderItemsService.name);

  constructor(
    private readonly repository: OrderItemsRepository,
    private readonly mapper: OrderItemsMapper,
    private readonly ordersService: OrdersService,
    private readonly menuItemsService: MenuItemsService,
  ) {}

  async create(saveDto: OrderItemSaveDto, user: User): Promise<OrderItemDto> {
    const entity: OrderItem = this.mapper.mapDtoToEntity(saveDto);

    const order: Order =
      await this.ordersService.getActiveEntityByIdWithRelations(
        saveDto.orderId,
      );

    checkOrderAccess(order, user);

    entity.order = order;
    entity.active = true;

    entity.menuItem = await this.menuItemsService.getActiveEntityById(
      saveDto.menuItemId,
    );

    await this.repository.save(entity);

    this.logger.log(
      `Order item created: id ${entity.id}, ` +
        `order id ${entity.order.id}, ` +
        `menu item id ${entity.menuItem.id}`,
    );

    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveOrderItems(user: User): Promise<OrderItemDto[]> {
    const orderItems: OrderItem[] = await this.repository.findAllActive();

    if (orderItems.length === 0) {
      throw new EntityNotFoundException(OrderItem.name);
    }

    const accessibleOrderItems = orderItems.filter((orderItem) => {
      try {
        checkOrderAccess(orderItem.order, user);

        return true;
      } catch {
        return false;
      }
    });

    if (accessibleOrderItems.length === 0) {
      throw new EntityNotFoundException(OrderItem.name);
    }

    return this.mapper.mapEntityListToDtoList(accessibleOrderItems);
  }

  async getActiveOrderItemById(id: number, user: User): Promise<OrderItemDto> {
    const orderItem = await this.getActiveEntityById(id);

    checkOrderAccess(orderItem.order, user);

    return this.mapper.mapEntityToDto(orderItem);
  }

  async getActiveEntityById(id: number): Promise<OrderItem> {
    const orderItem: OrderItem | null = await this.repository.findById(id);

    if (!orderItem || !orderItem.active) {
      throw new EntityNotFoundException(OrderItem.name, id);
    }

    return orderItem;
  }

  async update(
    id: number,
    updateItemDto: OrderItemUpdateDto,
    user: User,
  ): Promise<void> {
    const foundOrderItem = await this.getActiveEntityById(id);

    checkOrderAccess(foundOrderItem.order, user);

    foundOrderItem.quantity = updateItemDto.newQuantity;

    await this.repository.save(foundOrderItem);

    this.logger.log(
      `Order item updated: id ${id}, ` +
        `new quantity ${foundOrderItem.quantity}`,
    );
  }

  async deleteById(id: number, user: User): Promise<void> {
    const orderItem = await this.getActiveEntityById(id);

    checkOrderAccess(orderItem.order, user);

    orderItem.active = false;

    await this.repository.save(orderItem);

    this.logger.log(`Order item marked as inactive: id ${id}`);
  }

  async restoreById(id: number, user: User): Promise<void> {
    const orderItem: OrderItem | null = await this.repository.findById(id);

    if (!orderItem) {
      throw new EntityNotFoundException(OrderItem.name, id);
    }

    checkOrderAccess(orderItem.order, user);

    if (!orderItem.active) {
      orderItem.active = true;

      await this.repository.save(orderItem);

      this.logger.log(`Order item marked as active: id ${id}`);
    }
  }
}
