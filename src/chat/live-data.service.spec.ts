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
  let getOrderByIdWithRelations: jest.Mock;
  let getCurrentOrders: jest.Mock;

  beforeEach((): void => {
    getOrderByIdWithRelations = jest.fn();
    getCurrentOrders = jest.fn();

    ordersService = {
      getOrderByIdWithRelations,
      getCurrentOrders,
    } as unknown as jest.Mocked<OrdersService>;

    service = new LiveDataService(ordersService);

    getOrderByIdWithRelations.mockResolvedValue(ORDER);
    getCurrentOrders.mockResolvedValue([ORDER]);
  });

  it('should return live order data for its customer', async (): Promise<void> => {
    const result: string = await service.getLiveData(
      classification,
      10,
      Role.CUSTOMER,
    );

    expect(result).toContain('Заказ №123');
    expect(result).toContain('Статус: NEW');

    expect(getOrderByIdWithRelations).toHaveBeenCalledWith(123, {
      id: 10,
      role: Role.CUSTOMER,
    });

    expect(getCurrentOrders).not.toHaveBeenCalled();
  });

  it('should return live order data for its courier', async (): Promise<void> => {
    const result: string = await service.getLiveData(
      classification,
      20,
      Role.COURIER,
    );

    expect(result).toContain('Заказ №123');
    expect(result).toContain('Курьер: Courier');
  });

  it('should return accessible orders for a customer', async (): Promise<void> => {
    const result: string = await service.getLiveData(
      ordersClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result).toContain('Заказ №123');
    expect(getCurrentOrders).toHaveBeenCalledWith({
      id: 10,
      role: Role.CUSTOMER,
    });
    expect(getOrderByIdWithRelations).not.toHaveBeenCalled();
  });

  it('should return accessible orders for a courier', async (): Promise<void> => {
    const result: string = await service.getLiveData(
      ordersClassification,
      20,
      Role.COURIER,
    );

    expect(result).toContain('Заказ №123');
    expect(getCurrentOrders).toHaveBeenCalledWith({
      id: 20,
      role: Role.COURIER,
    });
  });

  it('should return all orders for manager and admin', async (): Promise<void> => {
    await expect(
      service.getLiveData(ordersClassification, 999, Role.MANAGER),
    ).resolves.toContain('Заказ №123');

    await expect(
      service.getLiveData(ordersClassification, 999, Role.ADMIN),
    ).resolves.toContain('Заказ №123');
  });

  it('should return only current orders provided by OrdersService', async (): Promise<void> => {
    const currentOrder: OrderDto = {
      ...ORDER,
      status: Status.DELIVERING,
    };

    getCurrentOrders.mockResolvedValue([currentOrder]);

    const result: string = await service.getLiveData(
      ordersClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result).toContain('Статус: DELIVERING');
    expect(result).not.toContain('COMPLETED');
    expect(result).not.toContain('CANCELLED_CUSTOMER');
    expect(result).not.toContain('CANCELLED_COURIER');
    expect(getCurrentOrders).toHaveBeenCalledWith({
      id: 10,
      role: Role.CUSTOMER,
    });
  });

  it('should return customer no-orders message', async (): Promise<void> => {
    getCurrentOrders.mockRejectedValue(new EntityNotFoundException('Order'));

    await expect(
      service.getLiveData(ordersClassification, 10, Role.CUSTOMER),
    ).resolves.toBe('У вас нет заказов.');
  });

  it('should return courier no-orders message', async (): Promise<void> => {
    getCurrentOrders.mockRejectedValue(new EntityNotFoundException('Order'));

    await expect(
      service.getLiveData(ordersClassification, 20, Role.COURIER),
    ).resolves.toBe('У вас нет заказов на выполнение.');
  });

  it('should deny customer access to another customer order without exposing data', async (): Promise<void> => {
    getOrderByIdWithRelations.mockRejectedValue(
      new ForbiddenException('Customer can only access own orders'),
    );

    await expect(
      service.getLiveData(classification, 999, Role.CUSTOMER),
    ).resolves.toBe('У вас нет заказа №123 среди ваших заказов.');

    expect(getOrderByIdWithRelations).toHaveBeenCalledWith(123, {
      id: 999,
      role: Role.CUSTOMER,
    });
  });

  it('should return no-order message when a requested order is not available', async (): Promise<void> => {
    getOrderByIdWithRelations.mockRejectedValue(
      new EntityNotFoundException('Order', 123),
    );

    await expect(
      service.getLiveData(classification, 10, Role.CUSTOMER),
    ).resolves.toBe('У вас нет заказа №123 среди ваших заказов.');
  });

  it('should propagate unexpected backend errors', async (): Promise<void> => {
    const error: Error = new Error('Database unavailable');
    getOrderByIdWithRelations.mockRejectedValue(error);

    await expect(
      service.getLiveData(classification, 10, Role.CUSTOMER),
    ).rejects.toBe(error);
  });

  it('should not query orders when classification is not an order resource', async (): Promise<void> => {
    const nonOrderClassification: ChatClassification = {
      documentType: DocumentType.RESTAURANT,
      liveDataRequired: true,
    };

    const result: string = await service.getLiveData(
      nonOrderClassification,
      10,
      Role.CUSTOMER,
    );

    expect(result).toContain('актуальные данные');
    expect(getOrderByIdWithRelations).not.toHaveBeenCalled();
    expect(getCurrentOrders).not.toHaveBeenCalled();
  });
});
