import { GuestOrdersService } from './guest-orders.service';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { Order } from './order.entity';
import { OrderDto } from './dto/order.dto';
import { OrderItem } from '../order-items/order-item.entity';
import { OrderItemsRepository } from '../order-items/order-items.repository';
import { OrderItemsMapper } from '../order-items/dto/order-items.mapper';
import { MenuItemsService } from '../menu-items/menu-items.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { UsersService } from '../users/users.service';
import { GuestSession } from '../guest-sessions/guest-session.entity';
import { Status } from './enums/status.enum';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

describe('GuestOrdersService', (): void => {
  let service: GuestOrdersService;
  let repository: jest.Mocked<Pick<OrdersRepository,
    'findActiveByGuestSessionId' | 'findActiveByIdForGuestSession' | 'findActiveItemsByOrderId' |
    'findActiveDraftForGuest' | 'countActiveByGuestSessionId' | 'save'
  >>;
  let mapper: jest.Mocked<Pick<OrdersMapper,
    'mapEntityListToDtoList' | 'mapEntityToDto'
  >>;
  let orderItemsRepository: jest.Mocked<Pick<OrderItemsRepository, 'save'>>;
  let orderItemsMapper: jest.Mocked<Pick<OrderItemsMapper, 'mapEntityListToDtoList'>>;
  let menuItemsService: jest.Mocked<Pick<
    MenuItemsService,
    'getActiveEntityWithRestaurantById'
  >>;
  let restaurantsService: jest.Mocked<Pick<
    RestaurantsService,
    'getActiveEntityById'
  >>;
  let usersService: jest.Mocked<Pick<UsersService, 'findAvailableCourier'>>;

  const guestSession: GuestSession = {
    id: 'guest-session-a',
  } as GuestSession;

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
      findActiveDraftForGuest: jest.fn(),
      countActiveByGuestSessionId: jest.fn(),
      save: jest.fn(),
    };

    mapper = {
      mapEntityListToDtoList: jest.fn(),
      mapEntityToDto: jest.fn(),
    };

    orderItemsRepository = {
      save: jest.fn(),
    };

    orderItemsMapper = {
      mapEntityListToDtoList: jest.fn(),
    };

    menuItemsService = {
      getActiveEntityWithRestaurantById: jest.fn(),
    };

    restaurantsService = {
      getActiveEntityById: jest.fn(),
    };

    usersService = {
      findAvailableCourier: jest.fn(),
    };

    service = new GuestOrdersService(
      repository as unknown as OrdersRepository,
      mapper as unknown as OrdersMapper,
      orderItemsRepository as unknown as OrderItemsRepository,
      orderItemsMapper as unknown as OrderItemsMapper,
      menuItemsService as unknown as MenuItemsService,
      restaurantsService as unknown as RestaurantsService,
      usersService as unknown as UsersService,
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

  describe('getGuestOrdersWithItems', (): void => {
    it('should return an empty list when the guest has no orders', async (): Promise<void> => {
      repository.findActiveByGuestSessionId.mockResolvedValue([]);

      await expect(
        service.getGuestOrdersWithItems(guestSession),
      ).resolves.toEqual([]);
    });

    it('should return the guest order together with its items', async (): Promise<void> => {
      const mappedOrder: OrderDto = { id: 101 } as OrderDto;
      const items: OrderItem[] = [
        {
          id: 1,
          quantity: 2,
          menuItem: { id: 5, name: 'Pizza', price: '10.00' },
          active: true,
        } as OrderItem,
      ];

      repository.findActiveByGuestSessionId.mockResolvedValue([guestOrderA]);
      repository.findActiveItemsByOrderId.mockResolvedValue(items);
      mapper.mapEntityToDto.mockReturnValue(mappedOrder);
      orderItemsMapper.mapEntityListToDtoList.mockReturnValue([
        { id: 1 } as never,
      ]);

      const result = await service.getGuestOrdersWithItems(guestSession);

      expect(result).toHaveLength(1);
      expect(result[0].order).toBe(mappedOrder);
      expect(result[0].items).toHaveLength(1);
    });
  });

  describe('createDraft', (): void => {
    it('should return the existing draft of the same restaurant', async (): Promise<void> => {
      repository.findActiveDraftForGuest.mockResolvedValue(guestOrderA);
      repository.findActiveItemsByOrderId.mockResolvedValue([]);
      mapper.mapEntityToDto.mockReturnValue({ id: 101 } as OrderDto);

      const result = await service.createDraft(guestSession, 1);

      expect(result.order).toEqual(expect.objectContaining({ id: 101 }));
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a new draft when the session reached the order limit', async (): Promise<void> => {
      repository.findActiveDraftForGuest.mockResolvedValue(null);
      repository.countActiveByGuestSessionId.mockResolvedValue(5);

      await expect(service.createDraft(guestSession, 1)).rejects.toThrow(
        'cannot have more than 5 active orders',
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should create a new draft owned by the guest session', async (): Promise<void> => {
      repository.findActiveDraftForGuest.mockResolvedValue(null);
      repository.save.mockImplementation(async (order: Order): Promise<Order> => {
        order.id = 200;

        return order;
      });
      repository.findActiveItemsByOrderId.mockResolvedValue([]);
      restaurantsService.getActiveEntityById.mockResolvedValue({
        id: 1,
      } as never);
      mapper.mapEntityToDto.mockImplementation(
        (order: Order): OrderDto => ({ id: order.id } as OrderDto),
      );

      const result = await service.createDraft(guestSession, 1);

      expect(result.order.id).toBe(200);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: null,
          status: Status.NEW,
          totalPrice: 0,
          guestSession,
        }),
      );
    });
  });

  describe('addItem', (): void => {
    const menuItem = {
      id: 5,
      price: '10.00',
      menu: { restaurant: { id: 1 } },
    } as never;

    it('should add a position and recalculate the total', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue(guestOrderA);
      repository.findActiveItemsByOrderId.mockResolvedValue([]);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );
      repository.save.mockImplementation(
        async (order: Order): Promise<Order> => order,
      );

      await service.addItem(guestSession, 101, 5, 2);

      expect(orderItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 2, active: true }),
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalPrice: 0 }),
      );
    });

    it('should reject a menu item from another restaurant', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue(guestOrderA);
      repository.findActiveItemsByOrderId.mockResolvedValue([]);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue({
        id: 5,
        price: '10.00',
        menu: { restaurant: { id: 2 } },
      } as never);

      await expect(
        service.addItem(guestSession, 101, 5, 1),
      ).rejects.toThrow('does not belong to restaurant');
    });

    it('should reject changes of an order that already left the NEW status', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue({
        ...guestOrderA,
        status: Status.COOKING,
      });

      await expect(
        service.addItem(guestSession, 101, 5, 1),
      ).rejects.toThrow('can be modified by a guest only while status is NEW');
    });
  });

  describe('setGuestStatus', (): void => {
    it('should move the order forward in the status chain', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue({
        ...guestOrderA,
      });
      repository.findActiveItemsByOrderId.mockResolvedValue([
        { id: 1, quantity: 1, menuItem: { id: 5 } } as OrderItem,
      ]);
      repository.save.mockImplementation(
        async (order: Order): Promise<Order> => order,
      );

      await service.setGuestStatus(guestSession, 101, Status.ACCEPTED);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 101, status: Status.ACCEPTED }),
      );
    });

    it('should reject moving the order backwards', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue({
        ...guestOrderA,
        status: Status.COOKING,
      });

      await expect(
        service.setGuestStatus(guestSession, 101, Status.ACCEPTED),
      ).rejects.toThrow('Guest cannot change order status');
    });

    it('should reject cancellation statuses', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue(guestOrderA);

      await expect(
        service.setGuestStatus(guestSession, 101, Status.CANCELLED_CUSTOMER),
      ).rejects.toThrow('Guest cannot change order status');
    });

    it('should reject leaving NEW while the order is empty', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue({
        ...guestOrderA,
      });
      repository.findActiveItemsByOrderId.mockResolvedValue([]);

      await expect(
        service.setGuestStatus(guestSession, 101, Status.ACCEPTED),
      ).rejects.toThrow('is empty and cannot be accepted');
    });

    it('should assign a courier when the order becomes READY', async (): Promise<void> => {
      repository.findActiveByIdForGuestSession.mockResolvedValue({
        ...guestOrderA,
        status: Status.COOKING,
      });
      repository.findActiveItemsByOrderId.mockResolvedValue([
        { id: 1, quantity: 1, menuItem: { id: 5 } } as OrderItem,
      ]);
      repository.save.mockImplementation(
        async (order: Order): Promise<Order> => order,
      );
      usersService.findAvailableCourier.mockResolvedValue({
        id: 760,
        name: 'Courier',
      } as never);

      await service.setGuestStatus(guestSession, 101, Status.READY);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: Status.READY,
          courier: expect.objectContaining({ id: 760 }),
        }),
      );
    });
  });
});
