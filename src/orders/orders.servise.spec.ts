import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrdersMapper } from './dto/orders.mapper';
import { OrderSaveDto } from './dto/order.save-dto';
import { OrderUpdateDto } from './dto/order.update-dto';
import { OrderDto } from './dto/order.dto';
import { Order } from './order.entity';
import {
  CANCELLED_STATUSES,
  CLOSED_STATUSES,
  Status,
} from './enums/status.enum';
import {
  MAX_SUBMITTED_ORDERS_PER_CUSTOMER,
} from './validation/order-limits';
import { checkOrderStatusChange } from './validation/order-status-change';

import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Role } from '../users/enums/role.enum';

import { RestaurantsService } from '../restaurants/restaurants.service';
import { Restaurant } from '../restaurants/restaurant.entity';

import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.enums';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { RoleMismatchException } from '../exceptions/types/role-mismatch.exception';

describe('OrdersService', () => {
  const CUSTOMER = {
    id: 1,
    role: Role.CUSTOMER,
  } as User;

  const COURIER = {
    id: 2,
    role: Role.COURIER,
  } as User;

  const ADMIN = {
    id: 3,
    role: Role.ADMIN,
  } as User;

  const MANAGER = {
    id: 4,
    role: Role.MANAGER,
  } as User;

  const OTHER_CUSTOMER = {
    id: 999,
    role: Role.CUSTOMER,
  } as User;

  const OTHER_COURIER = {
    id: 999,
    role: Role.COURIER,
  } as User;

  const RESTAURANT = {
    id: 1,
  } as Restaurant;

  let service: OrdersService;

  let repository: jest.Mocked<OrdersRepository>;
  let mapper: jest.Mocked<OrdersMapper>;
  let usersService: jest.Mocked<UsersService>;
  let restaurantsService: jest.Mocked<RestaurantsService>;
  let audit: jest.Mocked<AuditService>;

  const makeOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 1,
      customer: CUSTOMER,
      courier: COURIER,
      restaurant: RESTAURANT,
      status: Status.NEW,
      totalPrice: 100,
      createdAt: new Date(),
      items: [],
      active: true,
      ...overrides,
    }) as Order;

  const makeDto = (order: Order): OrderDto =>
    order as unknown as OrderDto;

  const saveDto: OrderSaveDto = {
    restaurantId: RESTAURANT.id,
  };

  const updateDto: OrderUpdateDto = {
    courierId: COURIER.id,
  };

  beforeEach(async () => {
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

    service = module.get<OrdersService>(OrdersService);
    repository = module.get(OrdersRepository);
    mapper = module.get(OrdersMapper);
    usersService = module.get(UsersService);
    restaurantsService = module.get(RestaurantsService);
    audit = module.get(AuditService);

    repository.save.mockImplementation(
      async (entity: Order): Promise<Order> => entity,
    );

    repository.findActiveDraft.mockResolvedValue(null);
    repository.findAllActive.mockResolvedValue([]);
    repository.findById.mockResolvedValue(null);
    repository.findByIdWithRelations.mockResolvedValue(null);
    repository.countActiveItems.mockResolvedValue(1);
    repository.countSubmittedByCustomerId.mockResolvedValue(0);

    mapper.mapDtoToEntity.mockImplementation(
      (): Order => makeOrder(),
    );

    mapper.mapEntityToDto.mockImplementation(
      (order: Order): OrderDto => makeDto(order),
    );

    mapper.mapEntityListToDtoList.mockImplementation(
      (orders: Order[]): OrderDto[] => orders.map(makeDto),
    );

    restaurantsService.getActiveEntityById.mockResolvedValue(
      RESTAURANT,
    );

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

    mapper.mapDtoToEntity.mockImplementation(
      (): Order => makeOrder(),
    );

    mapper.mapEntityToDto.mockImplementation(
      (order: Order): OrderDto => makeDto(order),
    );

    mapper.mapEntityListToDtoList.mockImplementation(
      (orders: Order[]): OrderDto[] => orders.map(makeDto),
    );

    restaurantsService.getActiveEntityById.mockResolvedValue(
      RESTAURANT,
    );

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

  describe('create', () => {
    it('should return an existing active draft', async () => {
      const draft = makeOrder({
        id: 99,
      });

      repository.findActiveDraft.mockResolvedValue(draft);

      const result = await service.create(saveDto, CUSTOMER);

      expect(result).toBe(makeDto(draft));
      expect(repository.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('should create an active NEW order without a courier', async () => {
      const order = makeOrder({
        courier: null,
        status: Status.NEW,
        totalPrice: 0,
      });

      mapper.mapDtoToEntity.mockReturnValue(order);

      const result = await service.create(saveDto, CUSTOMER);

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

      expect(result).toBe(makeDto(order));
    });

    it('should write an audit record when an order is created', async () => {
      const order = makeOrder({
        courier: null,
      });

      mapper.mapDtoToEntity.mockReturnValue(order);

      await service.create(saveDto, CUSTOMER);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_CREATED,
          actorId: CUSTOMER.id,
          actorRole: CUSTOMER.role,
          entityType: 'Order',
          entityId: order.id,
        }),
      );
    });

    it('should propagate restaurant lookup errors and not save', async () => {
      const error = new EntityNotFoundException(
        Restaurant.name,
        RESTAURANT.id,
      );

      restaurantsService.getActiveEntityById.mockRejectedValue(error);

      await expect(
        service.create(saveDto, CUSTOMER),
      ).rejects.toBe(error);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllOrders', () => {
    it('should return all active orders for admin', async () => {
      const orders = [
        makeOrder(),
        makeOrder({ id: 2 }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      const result = await service.getAllOrders(ADMIN);

      expect(result).toHaveLength(2);
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith(
        orders,
      );
    });

    it('should return all active orders for manager', async () => {
      const orders = [
        makeOrder(),
        makeOrder({ id: 2 }),
      ];

      repository.findAllActive.mockResolvedValue(orders);

      const result = await service.getAllOrders(MANAGER);

      expect(result).toHaveLength(2);
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith(
        orders,
      );
    });

    it('should return only customer-owned orders', async () => {
      const ownOrder = makeOrder({
        customer: CUSTOMER,
      });

      const otherOrder = makeOrder({
        id: 2,
        customer: OTHER_CUSTOMER,
      });

      repository.findAllActive.mockResolvedValue([
        ownOrder,
        otherOrder,
      ]);

      await service.getAllOrders(CUSTOMER);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        ownOrder,
      ]);
    });

    it('should return only assigned courier orders', async () => {
      const assignedOrder = makeOrder({
        courier: COURIER,
      });

      const otherOrder = makeOrder({
        id: 2,
        courier: OTHER_COURIER,
      });

      repository.findAllActive.mockResolvedValue([
        assignedOrder,
        otherOrder,
      ]);

      await service.getAllOrders(COURIER);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        assignedOrder,
      ]);
    });

    it('should throw when there are no active orders', async () => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(
        service.getAllOrders(ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the user has no accessible orders', async () => {
      repository.findAllActive.mockResolvedValue([
        makeOrder({
          customer: OTHER_CUSTOMER,
        }),
      ]);

      await expect(
        service.getAllOrders(CUSTOMER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when an unknown role has no accessible orders', async () => {
      repository.findAllActive.mockResolvedValue([
        makeOrder(),
      ]);

      await expect(
        service.getAllOrders({
          id: 999,
          role: 'UNKNOWN' as Role,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when courier has no assigned orders', async () => {
      repository.findAllActive.mockResolvedValue([
        makeOrder({
          courier: OTHER_COURIER,
        }),
      ]);

      await expect(
        service.getAllOrders(COURIER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getCurrentOrders', () => {
    it('should return only non-terminal orders', async () => {
      const current = makeOrder({
        status: Status.NEW,
      });

      const cancelledCustomer = makeOrder({
        id: 2,
        status: Status.CANCELLED_CUSTOMER,
      });

      const cancelledCourier = makeOrder({
        id: 3,
        status: Status.CANCELLED_COURIER,
      });

      const completed = makeOrder({
        id: 4,
        status: Status.COMPLETED,
      });

      repository.findAllActive.mockResolvedValue([
        current,
        cancelledCustomer,
        cancelledCourier,
        completed,
      ]);

      const result = await service.getCurrentOrders(ADMIN);

      expect(result).toEqual([makeDto(current)]);
    });

    it('should exclude orders cancelled by staff', async () => {
      const current = makeOrder({
        status: Status.NEW,
      });

      const cancelled = makeOrder({
        id: 2,
        status: Status.CANCELLED_STAFF,
      });

      repository.findAllActive.mockResolvedValue([
        current,
        cancelled,
      ]);

      const result = await service.getCurrentOrders(ADMIN);

      expect(result).toEqual([makeDto(current)]);
    });

    it('should throw when all orders are terminal', async () => {
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

      await expect(
        service.getCurrentOrders(ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getOrderById', () => {
    it('should return an order for an admin', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result = await service.getOrderById(
        order.id,
        ADMIN,
      );

      expect(result).toEqual(makeDto(order));
    });

    it('should return an order for its customer', async () => {
      const order = makeOrder({
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result = await service.getOrderById(
        order.id,
        CUSTOMER,
      );

      expect(result).toEqual(makeDto(order));
    });

    it('should reject another customer', async () => {
      const order = makeOrder({
        customer: OTHER_CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.getOrderById(order.id, CUSTOMER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject an unassigned courier', async () => {
      const order = makeOrder({
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.getOrderById(order.id, COURIER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw when the order does not exist', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.getOrderById(999, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveEntityById', () => {
    it('should return an active order', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      expect(
        await service.getActiveEntityById(order.id),
      ).toBe(order);
    });

    it('should throw when the order is missing', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.getActiveEntityById(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          active: false,
        }),
      );

      await expect(
        service.getActiveEntityById(1),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveEntityByIdWithRelations', () => {
    it('should return an active order', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      expect(
        await service.getActiveEntityByIdWithRelations(
          order.id,
        ),
      ).toBe(order);
    });

    it('should throw when the order is missing', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.getActiveEntityByIdWithRelations(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async () => {
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

  describe('getOrderByIdWithRelations', () => {
    it('should return an accessible order for admin', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result =
        await service.getOrderByIdWithRelations(
          order.id,
          ADMIN,
        );

      expect(result).toEqual(makeDto(order));
    });

    it('should return an accessible order for customer', async () => {
      const order = makeOrder({
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result =
        await service.getOrderByIdWithRelations(
          order.id,
          CUSTOMER,
        );

      expect(result).toEqual(makeDto(order));
    });

    it('should reject an unauthorized customer', async () => {
      const order = makeOrder({
        customer: OTHER_CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.getOrderByIdWithRelations(
          order.id,
          CUSTOMER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw when the order is missing', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.getOrderByIdWithRelations(
          999,
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({
          active: false,
        }),
      );

      await expect(
        service.getOrderByIdWithRelations(
          1,
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveOrderByIdWithRelations', () => {
    it('should return an active order DTO', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(order);

      const result =
        await service.getActiveOrderByIdWithRelations(
          order.id,
        );

      expect(result).toEqual(makeDto(order));
    });

    it('should throw when the order is missing', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.getActiveOrderByIdWithRelations(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async () => {
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

  describe('update', () => {
    it.each([
      Status.NEW,
      Status.ACCEPTED,
      Status.COOKING,
      Status.READY,
    ])(
      'should assign a courier without changing %s status',
      async (status: Status) => {
        const order = makeOrder({
          status,
          courier: null,
        });

        repository.findByIdWithRelations.mockResolvedValue(
          order,
        );

        await service.update(order.id, updateDto);

        expect(order.courier).toBe(COURIER);
        expect(order.status).toBe(status);
        expect(repository.save).toHaveBeenCalledWith(order);
      },
    );

    it.each([
      Status.COMPLETED,
      Status.CANCELLED_CUSTOMER,
      Status.CANCELLED_COURIER,
      Status.CANCELLED_STAFF,
    ])(
      'should not change the courier of a %s order',
      async (status: Status) => {
        const order = makeOrder({
          status,
        });

        repository.findByIdWithRelations.mockResolvedValue(
          order,
        );

        await expect(
          service.update(order.id, updateDto),
        ).rejects.toBeInstanceOf(EntityUpdateException);

        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it('should throw when courierId is omitted', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.update(order.id, {}),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the selected user is not a courier', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      usersService.getActiveEntityById.mockResolvedValue(
        CUSTOMER,
      );

      await expect(
        service.update(order.id, updateDto),
      ).rejects.toBeInstanceOf(RoleMismatchException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should propagate courier lookup errors', async () => {
      const order = makeOrder();

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      const error = new EntityNotFoundException(
        User.name,
        999,
      );

      usersService.getActiveEntityById.mockRejectedValue(
        error,
      );

      await expect(
        service.update(order.id, {
          courierId: 999,
        }),
      ).rejects.toBe(error);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.update(999, updateDto),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteById', () => {
    it('should mark an active order inactive and save it', async () => {
      const order = makeOrder({
        active: true,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.deleteById(order.id);

      expect(order.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should throw when the order does not exist', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.deleteById(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', () => {
    it('should restore an inactive order', async () => {
      const order = makeOrder({
        active: false,
      });

      repository.findById.mockResolvedValue(order);

      await service.restoreById(order.id);

      expect(order.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should do nothing when the order is already active', async () => {
      const order = makeOrder({
        active: true,
      });

      repository.findById.mockResolvedValue(order);

      await service.restoreById(order.id);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.restoreById(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateTotalPrice', () => {
    it('should save the new total price', async () => {
      const order = makeOrder({
        totalPrice: 100,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.updateTotalPrice(order.id, 250);

      expect(order.totalPrice).toBe(250);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should throw when the order does not exist', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.updateTotalPrice(999, 250),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', () => {
    it('should reject setting the same status again', async () => {
      const order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.NEW,
          CUSTOMER,
        ),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a user who cannot access the order', async () => {
      const order = makeOrder({
        status: Status.NEW,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.ACCEPTED,
          OTHER_CUSTOMER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject an invalid status transition', async () => {
      const order = makeOrder({
        status: Status.COMPLETED,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.NEW,
          CUSTOMER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject accepting an empty order', async () => {
      const order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      repository.countActiveItems.mockResolvedValue(0);

      await expect(
        service.setStatus(
          order.id,
          Status.ACCEPTED,
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject accepting when customer reached the active-order limit', async () => {
      const order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      repository.countActiveItems.mockResolvedValue(1);

      repository.countSubmittedByCustomerId.mockResolvedValue(
        MAX_SUBMITTED_ORDERS_PER_CUSTOMER,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.ACCEPTED,
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow a manager to accept a NEW order', async () => {
      const order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.ACCEPTED,
        MANAGER,
      );

      expect(order.status).toBe(Status.ACCEPTED);
      expect(order.courier).toBeNull();
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow an admin to accept a NEW order', async () => {
      const order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.ACCEPTED,
        ADMIN,
      );

      expect(order.status).toBe(Status.ACCEPTED);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a manager to move ACCEPTED to COOKING', async () => {
      const order = makeOrder({
        status: Status.ACCEPTED,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.COOKING,
        MANAGER,
      );

      expect(order.status).toBe(Status.COOKING);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a manager to move COOKING to READY and automatically assign a courier', async () => {
      const order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      usersService.findAvailableCourier.mockResolvedValue(
        COURIER,
      );

      await service.setStatus(
        order.id,
        Status.READY,
        MANAGER,
      );

      expect(order.status).toBe(Status.READY);
      expect(order.courier).toBe(COURIER);
      expect(usersService.findAvailableCourier).toHaveBeenCalled();
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

    it('should move COOKING to READY without courier when no courier is available', async () => {
      const order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      usersService.findAvailableCourier.mockResolvedValue(
        null,
      );

      await service.setStatus(
        order.id,
        Status.READY,
        MANAGER,
      );

      expect(order.status).toBe(Status.READY);
      expect(order.courier).toBeNull();
      expect(repository.save).toHaveBeenCalledWith(order);

      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_COURIER_ASSIGNED,
        }),
      );
    });

    it('should not replace an already assigned courier when moving to READY', async () => {
      const existingCourier = {
        id: 55,
        role: Role.COURIER,
      } as User;

      const order = makeOrder({
        status: Status.COOKING,
        courier: existingCourier,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.READY,
        MANAGER,
      );

      expect(order.status).toBe(Status.READY);
      expect(order.courier).toBe(existingCourier);
      expect(
        usersService.findAvailableCourier,
      ).not.toHaveBeenCalled();
    });

    it('should allow a manager to cancel a NEW order as staff', async () => {
      const order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_STAFF,
        MANAGER,
      );

      expect(order.status).toBe(Status.CANCELLED_STAFF);
      expect(repository.countActiveItems).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a manager to cancel a READY order', async () => {
      const order = makeOrder({
        status: Status.READY,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_STAFF,
        MANAGER,
      );

      expect(order.status).toBe(Status.CANCELLED_STAFF);
    });

    it('should reject a manager cancelling a DELIVERING order', async () => {
      const order = makeOrder({
        status: Status.DELIVERING,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.CANCELLED_STAFF,
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow an admin to cancel an order as staff', async () => {
      const order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_STAFF,
        ADMIN,
      );

      expect(order.status).toBe(Status.CANCELLED_STAFF);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should reject customer using staff cancellation', async () => {
      const order = makeOrder({
        status: Status.READY,
        customer: CUSTOMER,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.CANCELLED_STAFF,
          CUSTOMER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject courier using staff cancellation', async () => {
      const order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.CANCELLED_STAFF,
          COURIER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should allow a courier to move READY to DELIVERING', async () => {
      const order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.DELIVERING,
        COURIER,
      );

      expect(order.status).toBe(Status.DELIVERING);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a courier to complete a DELIVERING order', async () => {
      const order = makeOrder({
        status: Status.DELIVERING,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.COMPLETED,
        COURIER,
      );

      expect(order.status).toBe(Status.COMPLETED);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a courier to cancel a READY order', async () => {
      const order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_COURIER,
        COURIER,
      );

      expect(order.status).toBe(Status.CANCELLED_COURIER);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a courier to cancel a DELIVERING order', async () => {
      const order = makeOrder({
        status: Status.DELIVERING,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_COURIER,
        COURIER,
      );

      expect(order.status).toBe(Status.CANCELLED_COURIER);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a customer to cancel a NEW order', async () => {
      const order = makeOrder({
        status: Status.NEW,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_CUSTOMER,
        CUSTOMER,
      );

      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow a customer to cancel an ACCEPTED order', async () => {
      const order = makeOrder({
        status: Status.ACCEPTED,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_CUSTOMER,
        CUSTOMER,
      );

      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);
    });

    it('should allow a customer to cancel a COOKING order', async () => {
      const order = makeOrder({
        status: Status.COOKING,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_CUSTOMER,
        CUSTOMER,
      );

      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);
    });

    it('should reject an unassigned courier from taking a READY order', async () => {
      const order = makeOrder({
        status: Status.READY,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.DELIVERING,
          COURIER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a different courier from taking the order', async () => {
      const order = makeOrder({
        status: Status.READY,
        courier: OTHER_COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.DELIVERING,
          COURIER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a customer trying to move NEW to ACCEPTED', async () => {
      const order = makeOrder({
        status: Status.NEW,
        customer: CUSTOMER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.ACCEPTED,
          CUSTOMER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a courier trying to move NEW to ACCEPTED', async () => {
      const order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.ACCEPTED,
          COURIER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a manager trying to move NEW directly to COOKING', async () => {
      const order = makeOrder({
        status: Status.NEW,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.COOKING,
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a manager trying to move ACCEPTED directly to READY', async () => {
      const order = makeOrder({
        status: Status.ACCEPTED,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.READY,
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject a courier trying to move READY directly to COMPLETED', async () => {
      const order = makeOrder({
        status: Status.READY,
        courier: COURIER,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await expect(
        service.setStatus(
          order.id,
          Status.COMPLETED,
          COURIER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(
        service.setStatus(
          999,
          Status.ACCEPTED,
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow admin to change the order status', async () => {
      const order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.ACCEPTED,
        ADMIN,
      );

      expect(order.status).toBe(Status.ACCEPTED);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should allow admin to move ACCEPTED to COOKING', async () => {
      const order = makeOrder({
        status: Status.ACCEPTED,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.COOKING,
        ADMIN,
      );

      expect(order.status).toBe(Status.COOKING);
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should automatically assign a courier when admin moves COOKING to READY', async () => {
      const order = makeOrder({
        status: Status.COOKING,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      usersService.findAvailableCourier.mockResolvedValue(
        COURIER,
      );

      await service.setStatus(
        order.id,
        Status.READY,
        ADMIN,
      );

      expect(order.status).toBe(Status.READY);
      expect(order.courier).toBe(COURIER);
      expect(usersService.findAvailableCourier).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(order);
    });

    it('should not assign a courier when admin moves NEW to ACCEPTED', async () => {
      const order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.ACCEPTED,
        ADMIN,
      );

      expect(order.status).toBe(Status.ACCEPTED);
      expect(order.courier).toBeNull();
      expect(
        usersService.findAvailableCourier,
      ).not.toHaveBeenCalled();
    });

    it('should not replace an existing courier when admin moves COOKING to READY', async () => {
      const existingCourier = {
        id: 55,
        role: Role.COURIER,
      } as User;

      const order = makeOrder({
        status: Status.COOKING,
        courier: existingCourier,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.READY,
        ADMIN,
      );

      expect(order.status).toBe(Status.READY);
      expect(order.courier).toBe(existingCourier);
      expect(
        usersService.findAvailableCourier,
      ).not.toHaveBeenCalled();
    });

    it('should not count active items for a NEW cancellation', async () => {
      const order = makeOrder({
        status: Status.NEW,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.CANCELLED_CUSTOMER,
        CUSTOMER,
      );

      expect(repository.countActiveItems).not.toHaveBeenCalled();
      expect(order.status).toBe(Status.CANCELLED_CUSTOMER);
    });

    it('should create a status audit record after changing status', async () => {
      const order = makeOrder({
        status: Status.ACCEPTED,
        courier: null,
      });

      repository.findByIdWithRelations.mockResolvedValue(
        order,
      );

      await service.setStatus(
        order.id,
        Status.COOKING,
        MANAGER,
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_STATUS_CHANGED,
          actorId: MANAGER.id,
          actorRole: MANAGER.role,
          entityType: 'Order',
          entityId: order.id,
          details: {
            from: Status.ACCEPTED,
            to: Status.COOKING,
          },
        }),
      );
    });
  });

  describe('status transition helper', () => {
    it('should allow an admin to use any status transition', () => {
      expect(() =>
        checkOrderStatusChange(
          Status.COMPLETED,
          Status.NEW,
          Role.ADMIN,
        ),
      ).not.toThrow();
    });

    it('should reject an invalid manager transition', () => {
      expect(() =>
        checkOrderStatusChange(
          Status.NEW,
          Status.COOKING,
          Role.MANAGER,
        ),
      ).toThrow(BadRequestException);
    });

    it('should allow a valid manager transition', () => {
      expect(() =>
        checkOrderStatusChange(
          Status.NEW,
          Status.ACCEPTED,
          Role.MANAGER,
        ),
      ).not.toThrow();
    });
  });

  describe('status constants', () => {
    it('should contain all closed statuses', () => {
      expect(CLOSED_STATUSES).toEqual(
        expect.arrayContaining([
          Status.COMPLETED,
          Status.CANCELLED_CUSTOMER,
          Status.CANCELLED_COURIER,
          Status.CANCELLED_STAFF,
        ]),
      );
    });

    it('should contain all cancelled statuses', () => {
      expect(CANCELLED_STATUSES).toEqual([
        Status.CANCELLED_CUSTOMER,
        Status.CANCELLED_COURIER,
        Status.CANCELLED_STAFF,
      ]);
    });
  });
});
