import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { MenuItem } from '../menu-items/menu-item.entity';

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
import { checkOrderModificationAllowed } from '../orders/validation/order-modification';
import {
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
} from '../orders/validation/order-limits';

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
    checkOrderModificationAllowed(order, user);

    entity.order = order;
    entity.active = true;

    const menuItem: MenuItem =
      await this.menuItemsService.getActiveEntityWithRestaurantById(
        saveDto.menuItemId,
      );

    if (menuItem.menu.restaurant.id !== order.restaurant.id) {
      throw new BadRequestException(
        `Menu item id ${menuItem.id} does not belong to restaurant id ${order.restaurant.id}`,
      );
    }

    const activeItems: OrderItem[] =
      await this.repository.findAllActiveByOrderId(order.id);

    if (activeItems.length >= MAX_ITEMS_PER_ORDER) {
      throw new BadRequestException(
        `Order id ${order.id} cannot contain more than ${MAX_ITEMS_PER_ORDER} items`,
      );
    }

    this.checkOrderTotalLimit(
      order.id,
      activeItems,
      Number(menuItem.price) * saveDto.quantity,
    );

    entity.menuItem = menuItem;

    await this.repository.save(entity);
    await this.recalculateOrderTotal(order.id);

    this.logger.log(
      `Order item created: id ${entity.id}, ` +
        `order id ${entity.order.id}, ` +
        `menu item id ${entity.menuItem.id}`,
    );

    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveOrderItems(user: User): Promise<OrderItemDto[]> {
    const orderItems: OrderItem[] = await this.repository.findAllActive();

    const accessibleOrderItems = orderItems.filter((orderItem) => {
      if (!orderItem.active) {
        return false;
      }

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
    checkOrderModificationAllowed(foundOrderItem.order, user);

    const otherItems: OrderItem[] = (
      await this.repository.findAllActiveByOrderId(foundOrderItem.order.id)
    ).filter((item) => item.id !== foundOrderItem.id);

    this.checkOrderTotalLimit(
      foundOrderItem.order.id,
      otherItems,
      Number(foundOrderItem.menuItem.price) * updateItemDto.newQuantity,
    );

    foundOrderItem.quantity = updateItemDto.newQuantity;

    await this.repository.save(foundOrderItem);
    await this.recalculateOrderTotal(foundOrderItem.order.id);

    this.logger.log(
      `Order item updated: id ${id}, ` +
        `new quantity ${foundOrderItem.quantity}`,
    );
  }

  async deleteById(id: number, user: User): Promise<void> {
    const orderItem = await this.getActiveEntityById(id);

    checkOrderAccess(orderItem.order, user);
    checkOrderModificationAllowed(orderItem.order, user);

    orderItem.active = false;

    await this.repository.save(orderItem);
    await this.recalculateOrderTotal(orderItem.order.id);

    this.logger.log(`Order item marked as inactive: id ${id}`);
  }

  async restoreById(id: number, user: User): Promise<void> {
    const orderItem: OrderItem | null = await this.repository.findById(id);

    if (!orderItem) {
      throw new EntityNotFoundException(OrderItem.name, id);
    }

    checkOrderAccess(orderItem.order, user);
    checkOrderModificationAllowed(orderItem.order, user);

    if (!orderItem.active) {
      const activeItems: OrderItem[] =
        await this.repository.findAllActiveByOrderId(orderItem.order.id);

      if (activeItems.length >= MAX_ITEMS_PER_ORDER) {
        throw new BadRequestException(
          `Order id ${orderItem.order.id} cannot contain more than ${MAX_ITEMS_PER_ORDER} items`,
        );
      }

      this.checkOrderTotalLimit(
        orderItem.order.id,
        activeItems,
        Number(orderItem.menuItem.price) * orderItem.quantity,
      );

      orderItem.active = true;

      await this.repository.save(orderItem);
      await this.recalculateOrderTotal(orderItem.order.id);

      this.logger.log(`Order item marked as active: id ${id}`);
    }
  }

  private checkOrderTotalLimit(
    orderId: number,
    otherItems: OrderItem[],
    extra: number,
  ): void {
    const current: number = otherItems.reduce(
      (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
      0,
    );

    if (current + extra > MAX_ORDER_TOTAL) {
      throw new BadRequestException(
        `Order id ${orderId} total cannot exceed ${MAX_ORDER_TOTAL}`,
      );
    }
  }

  private async recalculateOrderTotal(orderId: number): Promise<void> {
    const items: OrderItem[] =
      await this.repository.findAllActiveByOrderId(orderId);

    const total: number = items.reduce(
      (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
      0,
    );

    await this.ordersService.updateTotalPrice(
      orderId,
      Math.round(total * 100) / 100,
    );
  }
}
