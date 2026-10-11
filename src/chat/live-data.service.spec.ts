import { ForbiddenException } from '@nestjs/common';
import { LiveDataService } from './live-data.service';
import { OrdersService } from '../orders/orders.service';
import { Role } from '../users/enums/role.enum';
import { Status } from '../orders/enums/status.enum';
import { OrderDto } from '../orders/dto/order.dto';
import { ChatClassification } from './types/chat-classification';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { LiveDataResource } from './enums/live-data-resource.enum';
import { LiveDataResult } from './types/live-data-result';

describe('LiveDataService', (): void => {
  const ORDER: OrderDto = {
    id: 123,
    customer: {
      id: 10,
      name: 'Customer',
    } as OrderDto['customer'],
    courier: {
      id: 20,
      name: 'Courier',
    } as NonNullable<OrderDto['courier']>,
    restaurant: {
      id: 30,
      name: 'Restaurant',
    } as OrderDto['restaurant'],
    status: Status.NEW,
    totalPrice: 25,
    createdAt: new Date('2026-09-06T10:00:00.000Z'),
  };

  const classification: ChatClassification = {
    documentType: DocumentType.ORDER,
    liveDataRequired: true,
    resource: LiveDataResource.ORDER,
    resourceId: 123,
  };

  const ordersClassification: ChatClassification = {
    documentType: DocumentType.ORDER,
    liveDataRequired: true,
    resource: LiveDataResource.ORDER,
  };

  let service: LiveDataService;
  let ordersService: jest.Mocked<OrdersService>;
  let getOrderWithItemsByIdForUser: jest.Mock;
  let getCurrentOrders: jest.Mock;

  beforeEach((): void => {
    getOrderWithItemsByIdForUser = jest.fn();
    getCurrentOrders = jest.fn();

    ordersService = {
      getOrderWithItemsByIdForUser,
      getCurrentOrders,
    } as unknown as jest.Mocked<OrdersService>;

    service = new LiveDataService(ordersService);

    getOrderWithItemsByIdForUser.mockResolvedValue({ order: ORDER, items: [] });
    getCurrentOrders.mockResolvedValue([ORDER]);
  });

  it('should return live order data for its customer', async (): Promise<void> => {
    const result: LiveDataResult = await service.getLiveData(
      classification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('Заказ №123');
    expect(result.context).toContain('Статус: NEW');

    expect(getOrderWithItemsByIdForUser).toHaveBeenCalledWith(123, {
      id: 10,
      role: Role.CUSTOMER,
    });

    expect(getCurrentOrders).not.toHaveBeenCalled();
  });

  it('should return live order data for its courier', async (): Promise<void> => {
    const result: LiveDataResult = await service.getLiveData(
      classification,
      20,
      Role.COURIER,
    );

    expect(result.context).toContain('Заказ №123');
    expect(result.context).toContain('Курьер: Courier');
  });

  it('should return accessible orders for a customer', async (): Promise<void> => {
    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('Заказ №123');

    expect(getCurrentOrders).toHaveBeenCalledWith({
      id: 10,
      role: Role.CUSTOMER,
    });

    expect(getOrderWithItemsByIdForUser).not.toHaveBeenCalled();
  });

  it('should return accessible orders for a courier', async (): Promise<void> => {
    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      20,
      Role.COURIER,
    );

    expect(result.context).toContain('Заказ №123');

    expect(getCurrentOrders).toHaveBeenCalledWith({
      id: 20,
      role: Role.COURIER,
    });
  });

  it('should return all orders for manager and admin', async (): Promise<void> => {
    await expect(
      service.getLiveData(ordersClassification, 999, Role.MANAGER),
    ).resolves.toMatchObject({
      context: expect.stringContaining('Заказ №123'),
    });

    await expect(
      service.getLiveData(ordersClassification, 999, Role.ADMIN),
    ).resolves.toMatchObject({
      context: expect.stringContaining('Заказ №123'),
    });
  });

  it('should return only current orders provided by OrdersService', async (): Promise<void> => {
    const currentOrder: OrderDto = {
      ...ORDER,
      status: Status.DELIVERING,
    };

    getCurrentOrders.mockResolvedValue([currentOrder]);

    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('Статус: DELIVERING');
    expect(result.context).not.toContain('COMPLETED');
    expect(result.context).not.toContain('CANCELLED_CUSTOMER');
    expect(result.context).not.toContain('CANCELLED_COURIER');

    expect(getCurrentOrders).toHaveBeenCalledWith({
      id: 10,
      role: Role.CUSTOMER,
    });
  });

  it('should return customer no-orders message', async (): Promise<void> => {
    getCurrentOrders.mockRejectedValue(new EntityNotFoundException('Order'));

    await expect(
      service.getLiveData(ordersClassification, 10, Role.CUSTOMER),
    ).resolves.toEqual({ context: 'У вас нет заказов.' });
  });

  it('should return courier no-orders message', async (): Promise<void> => {
    getCurrentOrders.mockRejectedValue(new EntityNotFoundException('Order'));

    await expect(
      service.getLiveData(ordersClassification, 20, Role.COURIER),
    ).resolves.toEqual({ context: 'У вас нет заказов на выполнение.' });
  });

  it('should deny customer access to another customer order without exposing data', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockRejectedValue(
      new ForbiddenException('Customer can only access own orders'),
    );

    await expect(
      service.getLiveData(classification, 999, Role.CUSTOMER),
    ).resolves.toEqual({
      context: 'У вас нет заказа №123 среди ваших заказов.',
    });

    expect(getOrderWithItemsByIdForUser).toHaveBeenCalledWith(123, {
      id: 999,
      role: Role.CUSTOMER,
    });
  });

  it('should return no-order message when a requested order is not available', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockRejectedValue(
      new EntityNotFoundException('Order', 123),
    );

    await expect(
      service.getLiveData(classification, 10, Role.CUSTOMER),
    ).resolves.toEqual({
      context: 'У вас нет заказа №123 среди ваших заказов.',
    });
  });

  it('should propagate unexpected backend errors', async (): Promise<void> => {
    const error: Error = new Error('Database unavailable');

    getOrderWithItemsByIdForUser.mockRejectedValue(error);

    await expect(
      service.getLiveData(classification, 10, Role.CUSTOMER),
    ).rejects.toBe(error);
  });

  it('should return courier-specific no-order message for an inaccessible order', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockRejectedValue(
      new EntityNotFoundException('Order', 123),
    );

    await expect(
      service.getLiveData(classification, 20, Role.COURIER),
    ).resolves.toEqual({ context: 'У вас нет заказа №123 на выполнение.' });
  });

  it('should return generic no-order message for manager when a requested order is unavailable', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockRejectedValue(
      new EntityNotFoundException('Order', 123),
    );

    await expect(
      service.getLiveData(classification, 999, Role.MANAGER),
    ).resolves.toEqual({ context: 'Заказ №123 не найден.' });
  });

  it('should propagate unexpected errors when loading current orders', async (): Promise<void> => {
    const error: Error = new Error('Database unavailable');

    getCurrentOrders.mockRejectedValue(error);

    await expect(
      service.getLiveData(ordersClassification, 10, Role.CUSTOMER),
    ).rejects.toBe(error);
  });

  it('should return generic no-orders message for manager', async (): Promise<void> => {
    getCurrentOrders.mockRejectedValue(new EntityNotFoundException('Order'));

    await expect(
      service.getLiveData(ordersClassification, 999, Role.MANAGER),
    ).resolves.toEqual({ context: 'В системе нет доступных заказов.' });
  });

  it('should format missing status and unassigned courier correctly', async (): Promise<void> => {
    const orderWithoutStatusOrCourier: OrderDto = {
      ...ORDER,
      status: undefined as unknown as Status,
      courier: null,
    };

    getCurrentOrders.mockResolvedValue([orderWithoutStatusOrCourier]);

    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('Статус: не указан');
    expect(result.context).toContain('Курьер: не назначен');
  });

  it('should not query orders when classification is not an order resource', async (): Promise<void> => {
    const nonOrderClassification: ChatClassification = {
      documentType: DocumentType.RESTAURANT,
      liveDataRequired: true,
    };

    const result: LiveDataResult = await service.getLiveData(
      nonOrderClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('актуальные данные');
    expect(getOrderWithItemsByIdForUser).not.toHaveBeenCalled();
    expect(getCurrentOrders).not.toHaveBeenCalled();
  });

  const orderOf = (id: number, status: Status, totalPrice: number): OrderDto =>
    ({
      id,
      status,
      totalPrice,
      restaurant: { name: 'Pizza House' },
      customer: { name: 'Customer Test' },
      courier: null,
      createdAt: new Date('2026-10-01T10:00:00Z'),
    }) as unknown as OrderDto;

  it('should not list empty carts among the current orders', async (): Promise<void> => {
    ordersService.getCurrentOrders.mockResolvedValue([
      orderOf(4, Status.NEW, 0),
      orderOf(19, Status.READY, 65.4),
    ]);

    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      1,
      Role.ADMIN,
    );

    expect(result.context).toContain('Заказ №19');
    expect(result.context).not.toContain('Заказ №4');
  });

  it('should answer that there are no orders when only empty carts exist', async (): Promise<void> => {
    ordersService.getCurrentOrders.mockResolvedValue([
      orderOf(4, Status.NEW, 0),
      orderOf(6, Status.NEW, 0),
    ]);

    await expect(
      service.getLiveData(ordersClassification, 1, Role.ADMIN),
    ).resolves.toEqual({ context: 'В системе нет доступных заказов.' });

    await expect(
      service.getLiveData(ordersClassification, 2, Role.CUSTOMER),
    ).resolves.toEqual({ context: 'У вас нет заказов.' });
  });

  it('should mark a single empty cart as empty when requested by id', async (): Promise<void> => {
    ordersService.getOrderWithItemsByIdForUser.mockResolvedValue({
      order: orderOf(4, Status.NEW, 0),
      items: [],
    });

    const result: LiveDataResult = await service.getLiveData(
      { ...classification, resourceId: 4 },
      1,
      Role.ADMIN,
    );

    expect(result.context).toContain('Заказ №4');
    expect(result.context).toContain('пустая корзина');
    expect(result.context).not.toContain('Состав заказа');
  });
  it('should not return an order id when several orders are visible', async (): Promise<void> => {
    ordersService.getCurrentOrders.mockResolvedValue([
      orderOf(1, Status.READY, 10),
      orderOf(2, Status.COOKING, 20),
    ]);

    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      1,
      Role.ADMIN,
    );

    expect(result.context).toContain('Заказ №1');
    expect(result.context).toContain('Заказ №2');
    expect(result.orderId).toBeUndefined();
  });

  it('should return the id of the only visible order when an empty cart is hidden', async (): Promise<void> => {
    ordersService.getCurrentOrders.mockResolvedValue([
      orderOf(4, Status.NEW, 0),
      orderOf(19, Status.READY, 65.4),
    ]);

    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      1,
      Role.ADMIN,
    );

    expect(result.orderId).toBe(19);
  });

  it('should not return an order id when access to the order is denied', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockRejectedValue(
      new ForbiddenException('Customer can only access own orders'),
    );

    const result: LiveDataResult = await service.getLiveData(
      classification,
      999,
      Role.CUSTOMER,
    );

    expect(result.orderId).toBeUndefined();
  });
  it('should include the order composition for a single order', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockResolvedValue({
      order: ORDER,
      items: [
        { name: 'Margherita', quantity: 2 },
        { name: 'Cola', quantity: 1 },
      ],
    });

    const result: LiveDataResult = await service.getLiveData(
      classification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('Состав заказа:');
    expect(result.context).toContain('- Margherita × 2');
    expect(result.context).toContain('- Cola × 1');
  });

  it('should say there are no active items when the order has none', async (): Promise<void> => {
    getOrderWithItemsByIdForUser.mockResolvedValue({
      order: ORDER,
      items: [],
    });

    const result: LiveDataResult = await service.getLiveData(
      classification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).toContain('Состав заказа: активных позиций нет.');
  });

  it('should not load or show the composition in the orders list', async (): Promise<void> => {
    const result: LiveDataResult = await service.getLiveData(
      ordersClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result.context).not.toContain('Состав заказа');
    expect(getOrderWithItemsByIdForUser).not.toHaveBeenCalled();
  });
});
