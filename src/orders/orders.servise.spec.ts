import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { RoleMismatchException } from '../exceptions/types/role-mismatch.exception';

import { Restaurant } from '../restaurants/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';

import { OrderSaveDto } from './dto/order.save-dto';
import { OrderUpdateDto } from './dto/order.update-dto';
import { OrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { Order } from './order.entity';
import { OrdersMapper } from './dto/orders.mapper';
import { Status } from './enums/status.enum';

import { UsersService } from '../users/users.service';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/user.entity';

import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.enums';

import { MAX_SUBMITTED_ORDERS_PER_CUSTOMER } from './validation/order-limits';

describe('OrdersService', (): void => {
  const CUSTOMER: User = {
    id: 1,
    role: Role.CUSTOMER,
  } as User;

  const COURIER: User = {
    id: 2,
    role: Role.COURIER,
  } as User;

  const ADMIN: User = {
    id: 3,
    role: Role.ADMIN,
  } as User;

  const MANAGER: User = {
    id: 4,
    role: Role.MANAGER,
  } as User;

  const RESTAURANT: Restaurant = {
    id: 1,
  } as Restaurant;

  const VALID_SAVE_DTO: OrderSaveDto = {
    restaurantId: RESTAURANT.id,
  };

  const VALID_UPDATE_DTO: OrderUpdateDto = {
    courierId: COURIER.id,
  };

  const makeOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 1,
      customer: CUSTOMER,
      courier: COURIER,
      restaurant: RESTAURANT,
      status: Status.NEW,
      totalPrice: 100,
      createdAt: new Date(2026, 7, 21),
      items: [],
      active: true,
      ...overrides,
    }) as Order;

  let service: OrdersService;

  beforeEach(() => {
    ORDER_1.active = true;
    ORDER_1.status = Status.NEW;
    ORDER_2.active = true;
    ORDER_2.status = Status.COMPLETED;
    jest.clearAllMocks();
  });
  let repository: jest.Mocked<OrdersRepository>;
  let mapper: jest.Mocked<OrdersMapper>;
  let usersService: jest.Mocked<UsersService>;
  let restaurantsService: jest.Mocked<RestaurantsService>;
  let audit: jest.Mocked<AuditService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: {
            save: jest.fn(),
            findActiveDraft: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
            findByIdWithRelations: jest.fn(),
            countActiveItems: jest.fn(),
            countSubmittedByCustomerId: jest.fn(),
          },
        },
        {
          provide: OrdersMapper,
          useValue: {
            mapDtoToEntity: jest.fn(),
            mapEntityToDto: jest.fn(),
            mapEntityListToDtoList: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getActiveEntityById: jest.fn(),
            findAvailableCourier: jest.fn(),
          },
        },
        {
          provide: RestaurantsService,
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    repository = module.get(OrdersRepository);
    mapper = module.get(OrdersMapper);
    usersService = module.get(UsersService);
    restaurantsService = module.get(RestaurantsService);
    audit = module.get(AuditService);

    jest.clearAllMocks();

    repository.save.mockImplementation(
      async (entity: Order): Promise<Order> => entity,
    );

    repository.findActiveDraft.mockResolvedValue(null);
    repository.findAllActive.mockResolvedValue([]);
    repository.findById.mockResolvedValue(null);
    repository.findByIdWithRelations.mockResolvedValue(null);
    repository.countActiveItems.mockResolvedValue(1);
    repository.countSubmittedByCustomerId.mockResolvedValue(0);

    mapper.mapDtoToEntity.mockImplementation((): Order => makeOrder());

    mapper.mapEntityToDto.mockImplementation(
      (order: Order): OrderDto => order as unknown as OrderDto,
    );

    mapper.mapEntityListToDtoList.mockImplementation(
      (orders: Order[]): OrderDto[] => orders as unknown as OrderDto[],
    );

    restaurantsService.getActiveEntityById.mockResolvedValue(RESTAURANT);

    usersService.getActiveEntityById.mockImplementation(
      async (id: number): Promise<User> => {
        if (id === COURIER.id) {
          return COURIER;
        }

        throw new EntityNotFoundException(User.name, id);
      },
    );

    usersService.findAvailableCourier.mockResolvedValue(null);

    audit.record.mockResolvedValue(undefined);
  });

  describe('create', (): void => {
    it('should return an existing active draft', async (): Promise<void> => {
      const draft: Order = makeOrder({
        id: 99,
      });

      repository.findActiveDraft.mockResolvedValue(draft);

      const result: OrderDto = await service.create(VALID_SAVE_DTO, CUSTOMER);

      expect(result).toBe(draft as unknown as OrderDto);

      expect(repository.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('should create an active NEW order without a courier', async (): Promise<void> => {
      const order: Order = makeOrder({
        courier: null,
        totalPrice: 0,
        status: Status.NEW,
      });

      mapper.mapDtoToEntity.mockReturnValue(order);

      const result: OrderDto = await service.create(VALID_SAVE_DTO, CUSTOMER);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: CUSTOMER,
          restaurant: RESTAURANT,
          courier: null,
          status: Status.NEW,
          active: true,
          totalPrice: 0,
        }),
      );

      expect(result).toBe(order as unknown as OrderDto);
    });

    it('should write an audit record when an order is created', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
      });

      mapper.mapDtoToEntity.mockReturnValue(order);

      await service.create(VALID_SAVE_DTO, CUSTOMER);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_CREATED,
          actorId: CUSTOMER.id,
          actorRole: CUSTOMER.role,
          entityId: order.id,
        }),
      );
    });

    it('should propagate restaurant lookup errors and not save', async (): Promise<void> => {
      const error = new EntityNotFoundException(Restaurant.name, 999);

      restaurantsService.getActiveEntityById.mockRejectedValue(error);

      await expect(service.create(VALID_SAVE_DTO, CUSTOMER)).rejects.toBe(
        error,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllOrders', (): void => {
    it('should return all active orders for admin', async (): Promise<void> => {
      const orders: Order[] = [
        makeOrder(),
        makeOrder({
          id: 2,
        }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      const result: OrderDto[] = await service.getAllOrders(ADMIN);

      expect(result).toHaveLength(2);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith(orders);
    });

    it('should return all active orders for manager', async (): Promise<void> => {
      const orders: Order[] = [
        makeOrder(),
        makeOrder({
          id: 2,
        }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      const result: OrderDto[] = await service.getAllOrders(MANAGER);

      expect(result).toHaveLength(2);
    });

    it('should return only customer-owned orders', async (): Promise<void> => {
      const orders: Order[] = [
        makeOrder({
          customer: CUSTOMER,
        }),
        makeOrder({
          id: 2,
          customer: {
            id: 999,
          } as User,
        }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      await service.getAllOrders(CUSTOMER);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([orders[0]]);
    });

    it('should return only assigned courier orders', async (): Promise<void> => {
      const orders: Order[] = [
        makeOrder({
          courier: COURIER,
        }),
        makeOrder({
          id: 2,
          courier: {
            id: 999,
          } as User,
        }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      await service.getAllOrders(COURIER);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([orders[0]]);
    });

    it('should throw when there are no active orders', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(service.getAllOrders(ADMIN)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw when the user has no accessible orders', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([
        makeOrder({
          customer: {
            id: 999,
          } as User,
        }),
      ]);

      await expect(service.getAllOrders(CUSTOMER)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw when an unknown role has no accessible orders', async (): Promise<void> => {
      await expect(
        service.getAllOrders({
          id: 999,
          role: 'unknown' as Role,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when courier has no assigned orders', async (): Promise<void> => {
      await expect(
        service.getAllOrders({
          id: 999,
          role: Role.COURIER,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getCurrentOrders', (): void => {
    it('should return only non-terminal orders', async (): Promise<void> => {
      const orders: Order[] = [
        makeOrder({
          status: Status.NEW,
        }),
        makeOrder({
          id: 2,
          status: Status.CANCELLED_CUSTOMER,
        }),
        makeOrder({
          id: 3,
          status: Status.CANCELLED_COURIER,
        }),
        makeOrder({
          id: 4,
          status: Status.COMPLETED,
        }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      const result: OrderDto[] = await service.getCurrentOrders(ADMIN);

      expect(result).toEqual([orders[0] as unknown as OrderDto]);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([orders[0]]);
    });

    it('should exclude orders cancelled by staff', async (): Promise<void> => {
      const orders: Order[] = [
        makeOrder({ status: Status.NEW }),
        makeOrder({ id: 2, status: Status.CANCELLED_STAFF }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      const result: OrderDto[] = await service.getCurrentOrders(ADMIN);

      expect(result).toEqual([orders[0] as unknown as OrderDto]);
    });

    it('should throw when all orders are terminal', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([
        makeOrder({
          status: Status.COMPLETED,
        }),
        makeOrder({
          id: 2,
          status: Status.CANCELLED_CUSTOMER,
        }),
        makeOrder({
          id: 3,
          status: Status.CANCELLED_COURIER,
        }),
      ]);

      await expect(service.getCurrentOrders(ADMIN)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('getOrderById', (): void => {
    it('should return an order for an admin', async (): Promise<void> => {
      const order: Order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result: OrderDto = await service.getOrderById(order.id, ADMIN);

      expect(result).toBe(order as unknown as OrderDto);
    });

    it('should return an order for its customer', async (): Promise<void> => {
      const order: Order = makeOrder({
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result: OrderDto = await service.getOrderById(order.id, CUSTOMER);

      expect(result).toBe(order as unknown as OrderDto);
    });

    it('should reject another customer', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          customer: {
            id: 999,
          } as User,
        }),
      );

      await expect(service.getOrderById(1, CUSTOMER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should reject an unassigned courier', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          courier: null,
        }),
      );

      await expect(service.getOrderById(1, COURIER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(service.getOrderById(999, ADMIN)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('getActiveEntityById', (): void => {
    it('should return an active order', async (): Promise<void> => {
      const order: Order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      expect(await service.getActiveEntityById(order.id)).toBe(order);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(service.getActiveEntityById(999)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          active: false,
        }),
      );
    });

    it('should not save when courierId is omitted', async (): Promise<void> => {
      await service.update(ORDER_1.id, {});

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the new courier has a non-courier role', async (): Promise<void> => {
      usersService.getActiveEntityById.mockResolvedValue(CUSTOMER);

      await expect(
        service.update(ORDER_1.id, VALID_UPDATE_DTO),
      ).rejects.toBeInstanceOf(RoleMismatchException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should propagate courier lookup errors', async (): Promise<void> => {
      const error = new EntityNotFoundException(User.name, 999);
      usersService.getActiveEntityById.mockRejectedValue(error);

      await expect(
        service.update(ORDER_1.id, {
          courierId: 999,
        }),
      ).rejects.toBe(error);
      expect(repository.save).not.toHaveBeenCalled();
    });

      await expect(service.getActiveEntityById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', (): void => {
    it('should restore an inactive order', async (): Promise<void> => {
      const inactiveOrder = {
        ...ORDER_1,
        active: false,
      } as Order;

      repository.findById.mockResolvedValue(inactiveOrder);

      await service.restoreById(ORDER_1.id);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ORDER_1.id,
          active: true,
        }),
      );
    });

    it('should do nothing when the order is already active', async (): Promise<void> => {
      repository.findById.mockResolvedValue({
        ...ORDER_1,
        active: true,
      } as Order);

      await service.restoreById(ORDER_1.id);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.restoreById(999)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', (): void => {
    it('should reject setting the current status again', async (): Promise<void> => {
      await expect(
        service.setStatus(ORDER_1.id, Status.NEW, CUSTOMER),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a user who cannot access the order', async (): Promise<void> => {
      const otherCustomer = {
        id: 999,
        role: Role.CUSTOMER,
      } as User;

      await expect(
        service.setStatus(ORDER_1.id, Status.CREATED, otherCustomer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should change status for an authorized admin', async (): Promise<void> => {
      await service.setStatus(ORDER_1.id, Status.CREATED, ADMIN);

      expect(ORDER_1.status).toBe(Status.CREATED);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ORDER_1.id,
          status: Status.CREATED,
        }),
      );
    });

    it('should reject an invalid status transition', async (): Promise<void> => {
      const order = {
        ...ORDER_1,
        status: Status.COMPLETED,
      } as Order;

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(ORDER_1.id, Status.NEW, CUSTOMER),
      ).rejects.toThrow();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(
        service.setStatus(999, Status.CREATED, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveEntityByIdWithRelations', (): void => {
    it('should return an active order', async (): Promise<void> => {
      const order: Order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      expect(await service.getActiveEntityByIdWithRelations(1)).toBe(order);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(
        service.getActiveEntityByIdWithRelations(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          active: false,
        }),
      );

      await expect(
        service.getActiveEntityByIdWithRelations(1),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getOrderByIdWithRelations', (): void => {
    it('should return an accessible order', async (): Promise<void> => {
      const order: Order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result: OrderDto = await service.getOrderByIdWithRelations(
        1,
        ADMIN,
      );

      expect(result).toBe(order as unknown as OrderDto);
    });

    it('should reject an unauthorized customer', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          customer: {
            id: 999,
          } as User,
        }),
      );

      await expect(
        service.getOrderByIdWithRelations(1, CUSTOMER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(
        service.getOrderByIdWithRelations(999, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          active: false,
        }),
      );

      await expect(
        service.getOrderByIdWithRelations(1, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveOrderByIdWithRelations', (): void => {
    it('should return an active order DTO', async (): Promise<void> => {
      const order: Order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result: OrderDto = await service.getActiveOrderByIdWithRelations(1);

      expect(result).toBe(order as unknown as OrderDto);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(
        service.getActiveOrderByIdWithRelations(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          active: false,
        }),
      );

      await expect(
        service.getActiveOrderByIdWithRelations(1),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('update', (): void => {
    it('should assign a courier without changing NEW status', async (): Promise<void> => {
      const order: Order = makeOrder({
        courier: null,
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.update(1, VALID_UPDATE_DTO);

      expect(usersService.getActiveEntityById).toHaveBeenCalledWith(COURIER.id);

      expect(order.courier).toBe(COURIER);
      expect(order.status).toBe(Status.NEW);

      expect(repository.save).toHaveBeenCalledWith(order);
    });
    it.each([
      Status.COMPLETED,
      Status.CANCELLED_CUSTOMER,
      Status.CANCELLED_COURIER,
      Status.CANCELLED_STAFF,
    ])(
      'should not change the courier of a %s order',
      async (status: Status): Promise<void> => {
        repository.findByIdWithRelations.mockResolvedValue(
          makeOrder({ status }),
        );

        await expect(
          service.update(1, VALID_UPDATE_DTO),
        ).rejects.toBeInstanceOf(EntityUpdateException);

        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it('should assign a courier without changing ACCEPTED status', async (): Promise<void> => {
      const order: Order = makeOrder({
        courier: null,
        status: Status.ACCEPTED,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.update(1, VALID_UPDATE_DTO);

      expect(order.courier).toBe(COURIER);
      expect(order.status).toBe(Status.ACCEPTED);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should assign a courier without changing COOKING status', async (): Promise<void> => {
      const order: Order = makeOrder({
        courier: null,
        status: Status.COOKING,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.update(1, VALID_UPDATE_DTO);

      expect(order.courier).toBe(COURIER);
      expect(order.status).toBe(Status.COOKING);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should assign a courier without changing READY status', async (): Promise<void> => {
      const order: Order = makeOrder({
        courier: null,
        status: Status.READY,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.update(1, VALID_UPDATE_DTO);

      expect(order.courier).toBe(COURIER);
      expect(order.status).toBe(Status.READY);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should throw when courierId is omitted', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());

      await expect(service.update(1, {} as OrderUpdateDto)).rejects.toThrow(
        'Courier id must be specified',
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the selected user is not a courier', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());

      usersService.getActiveEntityById.mockResolvedValue(CUSTOMER);

      await expect(service.update(1, VALID_UPDATE_DTO)).rejects.toBeInstanceOf(
        RoleMismatchException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should propagate courier lookup errors', async (): Promise<void> => {
      const error = new EntityNotFoundException(User.name, 999);

      repository.findByIdWithRelations.mockResolvedValue(makeOrder());

      usersService.getActiveEntityById.mockRejectedValue(error);

      await expect(
        service.update(1, {
          courierId: 999,
        }),
      ).rejects.toBe(error);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(
        service.update(999, VALID_UPDATE_DTO),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('deleteById', (): void => {
    it('should mark an active order inactive and save it', async (): Promise<void> => {
      const order: Order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.deleteById(1);

      expect(order.active).toBe(false);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(service.deleteById(999)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', (): void => {
    it('should restore an inactive order', async (): Promise<void> => {
      const order: Order = makeOrder({
        active: false,
      });

      repository.findById.mockResolvedValue(order);

      await service.restoreById(1);

      expect(order.active).toBe(true);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should do nothing when the order is already active', async (): Promise<void> => {
      repository.findById.mockResolvedValue(
        makeOrder({
          active: true,
        }),
      );

      await service.restoreById(1);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.restoreById(999)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateTotalPrice', (): void => {
    it('should save the new total price', async (): Promise<void> => {
      const order: Order = makeOrder({
        totalPrice: 10,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.updateTotalPrice(1, 42.5);

      expect(order.totalPrice).toBe(42.5);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(service.updateTotalPrice(999, 42.5)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('setStatus', (): void => {
    it('should reject setting the same status again', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          status: Status.NEW,
        }),
      );

      await expect(
        service.setStatus(1, Status.NEW, CUSTOMER),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });
    it('should allow a manager to cancel a NEW order as staff', async (): Promise<void> => {
      const order: Order = makeOrder({ status: Status.NEW, courier: null });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_STAFF, MANAGER);

      expect(order.status).toBe(Status.CANCELLED_STAFF);
      expect(repository.countActiveItems).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a manager to cancel a READY order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_STAFF, MANAGER);

      expect(order.status).toBe(Status.CANCELLED_STAFF);
    });

    it('should reject a manager cancelling a DELIVERING order', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({ status: Status.DELIVERING, courier: COURIER }),
      );

      await expect(
        service.setStatus(1, Status.CANCELLED_STAFF, MANAGER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow an admin to cancel an order as staff', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_STAFF, ADMIN);

      expect(order.status).toBe(Status.CANCELLED_STAFF);
    });

    it('should not let a customer or a courier use the staff cancellation', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          status: Status.READY,
          customer: CUSTOMER,
          courier: COURIER,
        }),
      );

      await expect(
        service.setStatus(1, Status.CANCELLED_STAFF, CUSTOMER),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.setStatus(1, Status.CANCELLED_STAFF, COURIER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject an admin moving an empty NEW order straight to COOKING', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({ status: Status.NEW }),
      );

      repository.countActiveItems.mockResolvedValue(0);

      await expect(
        service.setStatus(1, Status.COOKING, ADMIN),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a user who cannot access the order', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          customer: CUSTOMER,
        }),
      );

      const otherCustomer: User = {
        id: 999,
        role: Role.CUSTOMER,
      } as User;

      await expect(
        service.setStatus(1, Status.ACCEPTED, otherCustomer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject an invalid status transition', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          status: Status.COMPLETED,
        }),
      );

      await expect(
        service.setStatus(1, Status.NEW, CUSTOMER),
      ).rejects.toThrow();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject accepting an empty order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      repository.countActiveItems.mockResolvedValue(0);

      await expect(
        service.setStatus(1, Status.ACCEPTED, MANAGER),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject accepting when the customer reached the active-order limit', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      repository.countActiveItems.mockResolvedValue(1);

      repository.countSubmittedByCustomerId.mockResolvedValue(
        MAX_SUBMITTED_ORDERS_PER_CUSTOMER,
      );

      await expect(
        service.setStatus(1, Status.ACCEPTED, MANAGER),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow a manager to accept a NEW order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      repository.countActiveItems.mockResolvedValue(1);

      repository.countSubmittedByCustomerId.mockResolvedValue(0);

      await service.setStatus(1, Status.ACCEPTED, MANAGER);

      expect(order.status).toBe(Status.ACCEPTED);

      expect(order.courier).toBeNull();

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();

      expect(repository.save).toHaveBeenCalledWith(order);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_STATUS_CHANGED,
          actorId: MANAGER.id,
          entityId: order.id,
          details: {
            from: Status.NEW,
            to: Status.ACCEPTED,
          },
        }),
      );
    });

    it('should allow an admin to accept a NEW order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      repository.countActiveItems.mockResolvedValue(1);

      repository.countSubmittedByCustomerId.mockResolvedValue(0);

      await service.setStatus(1, Status.ACCEPTED, ADMIN);

      expect(order.status).toBe(Status.ACCEPTED);

      expect(order.courier).toBeNull();

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a manager to move ACCEPTED to COOKING', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.ACCEPTED,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.COOKING, MANAGER);

      expect(order.status).toBe(Status.COOKING);

      expect(order.courier).toBeNull();

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a manager to move COOKING to READY and automatically assign a courier', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      usersService.findAvailableCourier.mockResolvedValue(COURIER);

      await service.setStatus(1, Status.READY, MANAGER);

      expect(order.status).toBe(Status.READY);

      expect(order.courier).toBe(COURIER);

      expect(usersService.findAvailableCourier).toHaveBeenCalledTimes(1);

      expect(repository.save).toHaveBeenCalledWith(order);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_STATUS_CHANGED,
          actorId: MANAGER.id,
          entityId: order.id,
          details: {
            from: Status.COOKING,
            to: Status.READY,
          },
        }),
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_COURIER_ASSIGNED,
          actorId: MANAGER.id,
          entityId: order.id,
          details: {
            courierId: COURIER.id,
            mode: 'AUTO',
          },
        }),
      );
    });

    it('should move COOKING to READY without courier when no courier is available', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      usersService.findAvailableCourier.mockResolvedValue(null);

      await service.setStatus(1, Status.READY, MANAGER);

      expect(order.status).toBe(Status.READY);

      expect(order.courier).toBeNull();

      expect(usersService.findAvailableCourier).toHaveBeenCalledTimes(1);

      expect(repository.save).toHaveBeenCalledWith(order);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_STATUS_CHANGED,
          actorId: MANAGER.id,
          entityId: order.id,
          details: {
            from: Status.COOKING,
            to: Status.READY,
          },
        }),
      );

      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_COURIER_ASSIGNED,
        }),
      );
    });

    it('should not replace an already assigned courier when moving to READY', async (): Promise<void> => {
      const existingCourier: User = {
        id: 55,
        role: Role.COURIER,
      } as User;

      const order: Order = makeOrder({
        status: Status.COOKING,
        courier: existingCourier,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.READY, MANAGER);

      expect(order.status).toBe(Status.READY);

      expect(order.courier).toBe(existingCourier);

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a courier to move READY to DELIVERING', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.DELIVERING, COURIER);

      expect(order.status).toBe(Status.DELIVERING);

      expect(order.courier).toBe(COURIER);

      expect(repository.save).toHaveBeenCalledWith(order);

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();
    });

    it('should allow a courier to complete a DELIVERING order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.DELIVERING,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.COMPLETED, COURIER);

      expect(order.status).toBe(Status.COMPLETED);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a courier to cancel a READY order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_COURIER, COURIER);

      expect(order.status).toBe(Status.CANCELLED_COURIER);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a courier to cancel a DELIVERING order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.DELIVERING,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_COURIER, COURIER);

      expect(order.status).toBe(Status.CANCELLED_COURIER);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a customer to cancel a NEW order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_CUSTOMER, CUSTOMER);

      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a customer to cancel an ACCEPTED order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.ACCEPTED,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_CUSTOMER, CUSTOMER);

      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a customer to cancel a COOKING order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.COOKING,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.CANCELLED_CUSTOMER, CUSTOMER);

      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should reject an unassigned courier from taking a READY order', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.READY,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.DELIVERING, COURIER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a different courier from taking the order', async (): Promise<void> => {
      const assignedCourier: User = {
        id: 99,
        role: Role.COURIER,
      } as User;

      const order: Order = makeOrder({
        status: Status.READY,
        courier: assignedCourier,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.DELIVERING, COURIER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a customer trying to move NEW to ACCEPTED', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.ACCEPTED, CUSTOMER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a courier trying to move NEW to ACCEPTED', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.ACCEPTED, COURIER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a manager trying to move NEW directly to COOKING', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.COOKING, MANAGER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a manager trying to move ACCEPTED directly to READY', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.ACCEPTED,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.READY, MANAGER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a courier trying to move READY directly to COMPLETED', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.setStatus(1, Status.COMPLETED, COURIER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(
        service.setStatus(999, Status.ACCEPTED, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow admin to change the order status', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.ACCEPTED, ADMIN);

      expect(order.status).toBe(Status.ACCEPTED);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow admin to move ACCEPTED to COOKING', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.ACCEPTED,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.COOKING, ADMIN);

      expect(order.status).toBe(Status.COOKING);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should automatically assign a courier when admin moves COOKING to READY', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      usersService.findAvailableCourier.mockResolvedValue(COURIER);

      await service.setStatus(1, Status.READY, ADMIN);

      expect(order.status).toBe(Status.READY);

      expect(order.courier).toBe(COURIER);

      expect(usersService.findAvailableCourier).toHaveBeenCalledTimes(1);

      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should not assign a courier when admin moves NEW to ACCEPTED', async (): Promise<void> => {
      const order: Order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.ACCEPTED, ADMIN);

      expect(order.status).toBe(Status.ACCEPTED);

      expect(order.courier).toBeNull();

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();
    });

    it('should not replace an existing courier when admin moves COOKING to READY', async (): Promise<void> => {
      const existingCourier: User = {
        id: 55,
        role: Role.COURIER,
      } as User;

      const order: Order = makeOrder({
        status: Status.COOKING,
        courier: existingCourier,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.setStatus(1, Status.READY, ADMIN);

      expect(order.status).toBe(Status.READY);

      expect(order.courier).toBe(existingCourier);

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();
    });
  });
});
