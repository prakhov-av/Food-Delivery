import { GuestOrdersService } from './guest-orders.service';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { Order } from './order.entity';
import { OrderDto } from './dto/order.dto';
import { OrderItem } from '../order-items/order-item.entity';
import { Status } from './enums/status.enum';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

describe('GuestOrdersService', (): void => {
  let service: GuestOrdersService;
  let repository: jest.Mocked<Pick<OrdersRepository,
    'findActiveByGuestSessionId' | 'findActiveByIdForGuestSession' | 'findActiveItemsByOrderId'
  >>;
  let mapper: jest.Mocked<Pick<OrdersMapper,
    'mapEntityListToDtoList' | 'mapEntityToDto'
  >>;

  const guestOrderA: Order = {
    id: 101,
    customer: null,
    courier: null,
    guestSession: { id: 'guest-session-a' } as Order['guestSession'],
    restaurant: { id: 1 } as Order['restaurant'],
    status: Status.NEW,
    totalPrice: 25,
    createdAt: new Date('2026-11-09T10:00:00.000Z'),
    items: [],
    active: true,
  };

  const guestOrderB: Order = {
    ...guestOrderA,
    id: 102,
    status: Status.COMPLETED,
  };

  beforeEach((): void => {
    repository = {
      findActiveByGuestSessionId: jest.fn(),
      findActiveByIdForGuestSession: jest.fn(),
      findActiveItemsByOrderId: jest.fn(),
    };

    mapper = {
      mapEntityListToDtoList: jest.fn(),
      mapEntityToDto: jest.fn(),
    };

    service = new GuestOrdersService(
      repository as unknown as OrdersRepository,
      mapper as unknown as OrdersMapper,
    );
  });

  describe('getGuestOrders', (): void => {
    it('should return mapped active orders for the specified guest session', async (): Promise<void> => {
      const mappedOrders: OrderDto[] = [{ id: 101 } as OrderDto];
      repository.findActiveByGuestSessionId.mockResolvedValue([guestOrderA]);
      mapper.mapEntityListToDtoList.mockReturnValue(mappedOrders);

      const result = await service.getGuestOrders('guest-session-a');

      expect(result).toBe(mappedOrders);
      expect(repository.findActiveByGuestSessionId).toHaveBeenCalledWith(
        'guest-session-a',
      );
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([guestOrderA]);
    });

    it('should throw EntityNotFoundException when the guest session has no active orders', async (): Promise<void> => {
      repository.findActiveByGuestSessionId.mockResolvedValue([]);

      await expect(
        service.getGuestOrders('guest-session-a'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async (): Promise<void> => {
      repository.findActiveByGuestSessionId.mockRejectedValue(
        new Error('Repository failure'),
      );

      await expect(
        service.getGuestOrders('guest-session-a'),
      ).rejects.toThrow('Repository failure');
    });
  });

  describe('getCurrentGuestOrders', (): void => {
    it('should exclude completed and cancelled orders', async (): Promise<void> => {
      const mappedOrders: OrderDto[] = [{ id: 101 } as OrderDto];
      repository.findActiveByGuestSessionId.mockResolvedValue([
        guestOrderA,
        guestOrderB,
      ]);
      mapper.mapEntityListToDtoList.mockReturnValue(mappedOrders);

      const result = await service.getCurrentGuestOrders('guest-session-a');

      expect(result).toBe(mappedOrders);
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        guestOrderA,
      ]);
    });

    it('should throw EntityNotFoundException when only closed orders exist', async (): Promise<void> => {
      repository.findActiveByGuestSessionId.mockResolvedValue([guestOrderB]);

      await expect(
        service.getCurrentGuestOrders('guest-session-a'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when there are no orders', async (): Promise<void> => {
      repository.findActiveByGuestSessionId.mockResolvedValue([]);

      await expect(
        service.getCurrentGuestOrders('guest-session-a'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getGuestOrderWithItemsById', (): void => {
    it('should return the guest order and its active item lines', async (): Promise<void> => {
      const mappedOrder: OrderDto = { id: 101 } as OrderDto;
      const items: OrderItem[] = [
        {
          id: 1,
          quantity: 2,
          menuItem: { name: 'Pizza' },
          active: true,
        } as OrderItem,
        {
          id: 2,
          quantity: 1,
          menuItem: { name: 'Cola' },
          active: true,
        } as OrderItem,
      ];
      repository.findActiveByIdForGuestSession.mockResolvedValue(guestOrderA);
      repository.findActiveItemsByOrderId.mockResolvedValue(items);
      mapper.mapEntityToDto.mockReturnValue(mappedOrder);

      const result = await service.getGuestOrderWithItemsById(
        101,
        'guest-session-a',
      );

      expect(result).toEqual({
        order: mappedOrder,
        items: [
          { name: 'Pizza', quantity: 2 },
          { name: 'Cola', quantity: 1 },
        ],
      });
      expect(repository.findActiveByIdForGuestSession).toHaveBeenCalledWith(
        101,
        'guest-session-a',
      );
      expect(repository.findActiveItemsByOrderId).toHaveBeenCalledWith(101);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(guestOrderA);
    });

    it('should not load order items when the order belongs to another guest session', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue(null);

      await expect(
        service.getGuestOrderWithItemsById(101, 'guest-session-b'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.findActiveByIdForGuestSession).toHaveBeenCalledWith(
        101,
        'guest-session-b',
      );
      expect(repository.findActiveItemsByOrderId).not.toHaveBeenCalled();
      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });

    it('should propagate errors while loading order items', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue(guestOrderA);
      repository.findActiveItemsByOrderId.mockRejectedValue(
        new Error('Items query failed'),
      );

      await expect(
        service.getGuestOrderWithItemsById(101, 'guest-session-a'),
      ).rejects.toThrow('Items query failed');
    });
  });
});
