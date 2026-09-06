import { LiveDataService } from './live-data.service';
import { OrdersService } from '../orders/orders.service';
import { Role } from '../users/enums/role.enum';
import { Status } from '../orders/enums/status.enum';
import { OrderDto } from '../orders/dto/order.dto';
import { ChatClassification } from './types/chat-classification';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { DocumentType } from '../ingestion/enums/document-type.enum';

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
    resource: 'ORDER',
    resourceId: 123,
  };

  let service: LiveDataService;
  let ordersService: jest.Mocked<OrdersService>;

  beforeEach((): void => {
    ordersService = {
      getActiveOrderByIdWithRelations: jest.fn(),
    } as unknown as jest.Mocked<OrdersService>;

    service = new LiveDataService(ordersService);
    ordersService.getActiveOrderByIdWithRelations.mockResolvedValue(ORDER);
  });

  it('should return live order data for its customer', async (): Promise<void> => {
    const result: string = await service.getLiveData(
      classification,
      10,
      Role.CUSTOMER,
    );

    expect(result).toContain('Заказ №123');
    expect(result).toContain('Статус: NEW');
    expect(ordersService.getActiveOrderByIdWithRelations).toHaveBeenCalledWith(
      123,
    );
  });

  it('should return live order data for its courier', async (): Promise<void> => {
    const result: string = await service.getLiveData(
      classification,
      20,
      Role.COURIER,
    );

    expect(result).toContain('Заказ №123');
  });

  it('should deny customer access to another customer order', async (): Promise<void> => {
    await expect(
      service.getLiveData(classification, 999, Role.CUSTOMER),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should allow manager and admin access', async (): Promise<void> => {
    await expect(
      service.getLiveData(classification, 999, Role.MANAGER),
    ).resolves.toContain('Заказ №123');

    await expect(
      service.getLiveData(classification, 999, Role.ADMIN),
    ).resolves.toContain('Заказ №123');
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
    expect(ordersService.getActiveOrderByIdWithRelations).not.toHaveBeenCalled();
  });
});
