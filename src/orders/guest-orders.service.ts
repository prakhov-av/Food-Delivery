import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { Order } from './order.entity';
import { OrderDto } from './dto/order.dto';
import { CLOSED_STATUSES, Status } from './enums/status.enum';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { OrderItem } from '../order-items/order-item.entity';
import { OrderItemLine, OrderWithItems } from './types/order-with-items';

import { OrderItemsRepository } from '../order-items/order-items.repository';
import { OrderItemsMapper } from '../order-items/dto/order-items.mapper';
import { MenuItemsService } from '../menu-items/menu-items.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { UsersService } from '../users/users.service';
import { GuestSession } from '../guest-sessions/guest-session.entity';

import { GuestOrderDto } from './dto/guest-order.dto';
import { checkGuestStatusChange } from './validation/guest-order-status';
import {
  MAX_ACTIVE_GUEST_ORDERS,
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
  MAX_QUANTITY_PER_ITEM,
} from './validation/order-limits';

/**
 * Обеспечивает доступ гостевых сессий к собственным заказам.
 *
 * Все запросы ограничиваются идентификатором гостевой сессии.
 */
@Injectable()
export class GuestOrdersService {
  private readonly logger: Logger = new Logger(GuestOrdersService.name);

  constructor(
    private readonly repository: OrdersRepository,
    private readonly mapper: OrdersMapper,
    private readonly orderItemsRepository: OrderItemsRepository,
    private readonly orderItemsMapper: OrderItemsMapper,
    private readonly menuItemsService: MenuItemsService,
    private readonly restaurantsService: RestaurantsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Возвращает активные заказы гостевой сессии.
   */
  async getGuestOrders(guestSessionId: string): Promise<OrderDto[]> {
    const orders: Order[] =
      await this.repository.findActiveByGuestSessionId(guestSessionId);

    if (orders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(orders);
  }

  /**
   * Возвращает незакрытые заказы гостевой сессии.
   */
  async getCurrentGuestOrders(guestSessionId: string): Promise<OrderDto[]> {
    const orders: Order[] =
      await this.repository.findActiveByGuestSessionId(guestSessionId);

    const currentOrders: Order[] = orders.filter(
      (order: Order): boolean => !CLOSED_STATUSES.includes(order.status),
    );

    if (currentOrders.length === 0) {
      throw new EntityNotFoundException(Order.name);
    }

    return this.mapper.mapEntityListToDtoList(currentOrders);
  }

  /**
   * Возвращает заказ и его активные позиции,
   * если заказ принадлежит указанной гостевой сессии.
   */
  async getGuestOrderWithItemsById(
    orderId: number,
    guestSessionId: string,
  ): Promise<OrderWithItems> {
    const order: Order | null =
      await this.repository.findActiveByIdForGuestSession(
        orderId,
        guestSessionId,
      );

    if (!order) {
      throw new EntityNotFoundException(Order.name, orderId);
    }

    const items: OrderItem[] = await this.repository.findActiveItemsByOrderId(
      order.id,
    );

    return {
      order: this.mapper.mapEntityToDto(order),
      items: items.map((item: OrderItem): OrderItemLine => ({
        name: item.menuItem.name,
        quantity: item.quantity,
      })),
    };
  }

  /**
   * Возвращает заказы гостевой сессии вместе с позициями.
   *
   * В отличие от getGuestOrders не бросает исключение,
   * когда заказов ещё нет: пустой список — нормальное состояние гостя.
   */
  async getGuestOrdersWithItems(
    guestSession: GuestSession,
  ): Promise<GuestOrderDto[]> {
    const orders: Order[] =
      await this.repository.findActiveByGuestSessionId(guestSession.id);

    const result: GuestOrderDto[] = [];

    for (const order of orders) {
      result.push(await this.toGuestOrderDto(order));
    }

    return result;
  }

  /**
   * Возвращает или создаёт черновик заказа гостя в указанном ресторане.
   */
  async createDraft(
    guestSession: GuestSession,
    restaurantId: number,
  ): Promise<GuestOrderDto> {
    const draft: Order | null = await this.repository.findActiveDraftForGuest(
      guestSession.id,
      restaurantId,
    );

    if (draft) {
      return this.toGuestOrderDto(draft);
    }

    /**
     * Потолок активных заказов на сессию: гостю нельзя забить базу
     * черновиками. Для зарегистрированного клиента действует
     * аналогичное ограничение MAX_SUBMITTED_ORDERS_PER_CUSTOMER.
     */
    const activeOrders: number =
      await this.repository.countActiveByGuestSessionId(guestSession.id);

    if (activeOrders >= MAX_ACTIVE_GUEST_ORDERS) {
      throw new BadRequestException(
        `Guest session id ${guestSession.id} cannot have more than ${MAX_ACTIVE_GUEST_ORDERS} active orders`,
      );
    }

    const restaurant = await this.restaurantsService.getActiveEntityById(
      restaurantId,
    );

    const order: Order = new Order();

    order.customer = null;
    order.courier = null;
    order.guestSession = guestSession;
    order.restaurant = restaurant;
    order.status = Status.NEW;
    order.active = true;
    order.totalPrice = 0;

    const saved: Order = await this.repository.save(order);

    this.logger.log(
      `Guest order created: id ${saved.id}, ` +
        `guest session id ${guestSession.id}, ` +
        `restaurant id ${restaurant.id}`,
    );

    return this.toGuestOrderDto(saved);
  }

  /**
   * Добавляет позицию в заказ гостя.
   *
   * Если такая позиция уже есть, её количество увеличивается.
   */
  async addItem(
    guestSession: GuestSession,
    orderId: number,
    menuItemId: number,
    quantity: number,
  ): Promise<GuestOrderDto> {
    const order: Order = await this.getGuestOrderEntity(guestSession, orderId);

    this.checkGuestOrderEditable(order);

    const menuItem = await this.menuItemsService.getActiveEntityWithRestaurantById(
      menuItemId,
    );

    if (menuItem.menu.restaurant.id !== order.restaurant.id) {
      throw new BadRequestException(
        `Menu item id ${menuItem.id} does not belong to restaurant id ${order.restaurant.id}`,
      );
    }

    const activeItems: OrderItem[] =
      await this.repository.findActiveItemsByOrderId(order.id);

    const existing: OrderItem | undefined = activeItems.find(
      (item: OrderItem): boolean => item.menuItem.id === menuItem.id,
    );

    if (existing) {
      const newQuantity: number = existing.quantity + quantity;

      if (newQuantity > MAX_QUANTITY_PER_ITEM) {
        throw new BadRequestException(
          `Item id ${existing.id} cannot contain more than ${MAX_QUANTITY_PER_ITEM} items`,
        );
      }

      this.checkTotalLimit(
        order.id,
        activeItems.filter(
          (item: OrderItem): boolean => item.id !== existing.id,
        ),
        Number(menuItem.price) * newQuantity,
      );

      existing.quantity = newQuantity;

      await this.orderItemsRepository.save(existing);
    } else {
      if (activeItems.length >= MAX_ITEMS_PER_ORDER) {
        throw new BadRequestException(
          `Order id ${order.id} cannot contain more than ${MAX_ITEMS_PER_ORDER} items`,
        );
      }

      this.checkTotalLimit(
        order.id,
        activeItems,
        Number(menuItem.price) * quantity,
      );

      const entity: OrderItem = new OrderItem();

      entity.order = order;
      entity.menuItem = menuItem;
      entity.quantity = quantity;
      entity.active = true;

      await this.orderItemsRepository.save(entity);
    }

    await this.recalculateOrderTotal(order);

    return this.toGuestOrderDto(order);
  }

  /**
   * Изменяет количество позиции в заказе гостя.
   */
  async updateItem(
    guestSession: GuestSession,
    orderId: number,
    itemId: number,
    newQuantity: number,
  ): Promise<GuestOrderDto> {
    const order: Order = await this.getGuestOrderEntity(guestSession, orderId);

    this.checkGuestOrderEditable(order);

    const activeItems: OrderItem[] =
      await this.repository.findActiveItemsByOrderId(order.id);

    const item: OrderItem | undefined = activeItems.find(
      (orderItem: OrderItem): boolean => orderItem.id === itemId,
    );

    if (!item) {
      throw new EntityNotFoundException(OrderItem.name, itemId);
    }

    this.checkTotalLimit(
      order.id,
      activeItems.filter(
        (orderItem: OrderItem): boolean => orderItem.id !== item.id,
      ),
      Number(item.menuItem.price) * newQuantity,
    );

    item.quantity = newQuantity;

    await this.orderItemsRepository.save(item);

    await this.recalculateOrderTotal(order);

    return this.toGuestOrderDto(order);
  }

  /**
   * Удаляет позицию из заказа гостя.
   */
  async removeItem(
    guestSession: GuestSession,
    orderId: number,
    itemId: number,
  ): Promise<GuestOrderDto> {
    const order: Order = await this.getGuestOrderEntity(guestSession, orderId);

    this.checkGuestOrderEditable(order);

    const activeItems: OrderItem[] =
      await this.repository.findActiveItemsByOrderId(order.id);

    const item: OrderItem | undefined = activeItems.find(
      (orderItem: OrderItem): boolean => orderItem.id === itemId,
    );

    if (!item) {
      throw new EntityNotFoundException(OrderItem.name, itemId);
    }

    item.active = false;

    await this.orderItemsRepository.save(item);

    await this.recalculateOrderTotal(order);

    return this.toGuestOrderDto(order);
  }

  /**
   * Меняет статус заказа гостя.
   *
   * Гость двигает заказ по цепочке статусов вперёд.
   * Отмена гостю недоступна.
   */
  async setGuestStatus(
    guestSession: GuestSession,
    orderId: number,
    status: Status,
  ): Promise<GuestOrderDto> {
    const order: Order = await this.getGuestOrderEntity(guestSession, orderId);

    if (order.status === status) {
      throw new BadRequestException(
        `Order id ${orderId} already has status ${status}`,
      );
    }

    checkGuestStatusChange(order.status, status);

    /**
     * Заказ выходит из NEW только с позициями:
     * пустой заказ принять нельзя, как и для зарегистрированного клиента.
     */
    if (order.status === Status.NEW) {
      const activeItems: OrderItem[] =
        await this.repository.findActiveItemsByOrderId(order.id);

      if (activeItems.length === 0) {
        throw new BadRequestException(
          `Order id ${order.id} is empty and cannot be accepted`,
        );
      }
    }

    order.status = status;

    /**
     * READY: автоматически назначаем свободного курьера,
     * чтобы состояние заказа у гостя совпадало с состоянием обычного заказа.
     */
    if (status === Status.READY && !order.courier) {
      const courier = await this.usersService.findAvailableCourier();

      if (courier) {
        order.courier = courier;
      } else {
        this.logger.warn(`No available courier found for order id ${order.id}`);
      }
    }

    await this.repository.save(order);

    this.logger.log(
      `Guest order status changed: id ${order.id}, ` +
        `status ${status}, guest session id ${guestSession.id}`,
    );

    return this.toGuestOrderDto(order);
  }

  /**
   * Возвращает заказ гостя, если он принадлежит этой гостевой сессии.
   */
  private async getGuestOrderEntity(
    guestSession: GuestSession,
    orderId: number,
  ): Promise<Order> {
    const order: Order | null =
      await this.repository.findActiveByIdForGuestSession(
        orderId,
        guestSession.id,
      );

    if (!order) {
      throw new EntityNotFoundException(Order.name, orderId);
    }

    return order;
  }

  /**
   * Проверяет, что заказ гостя ещё можно менять.
   */
  private checkGuestOrderEditable(order: Order): void {
    if (order.status !== Status.NEW) {
      throw new BadRequestException(
        `Order id ${order.id} can be modified by a guest only while status is ${Status.NEW}`,
      );
    }
  }

  /**
   * Проверяет лимит суммы заказа.
   */
  private checkTotalLimit(
    orderId: number,
    otherItems: OrderItem[],
    extra: number,
  ): void {
    const current: number = otherItems.reduce(
      (sum: number, item: OrderItem): number =>
        sum + Number(item.menuItem.price) * item.quantity,
      0,
    );

    if (current + extra > MAX_ORDER_TOTAL) {
      throw new BadRequestException(
        `Order id ${orderId} total cannot exceed ${MAX_ORDER_TOTAL}`,
      );
    }
  }

  /**
   * Пересчитывает сумму заказа по активным позициям.
   */
  private async recalculateOrderTotal(order: Order): Promise<void> {
    const items: OrderItem[] =
      await this.repository.findActiveItemsByOrderId(order.id);

    const total: number = items.reduce(
      (sum: number, item: OrderItem): number =>
        sum + Number(item.menuItem.price) * item.quantity,
      0,
    );

    order.totalPrice = Math.round(total * 100) / 100;

    await this.repository.save(order);
  }

  /**
   * Собирает заказ вместе с позициями для ответа API.
   */
  private async toGuestOrderDto(order: Order): Promise<GuestOrderDto> {
    const items: OrderItem[] =
      await this.repository.findActiveItemsByOrderId(order.id);

    return {
      order: this.mapper.mapEntityToDto(order),
      items: this.orderItemsMapper.mapEntityListToDtoList(items),
    };
  }
}
