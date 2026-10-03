import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';

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
import { UsersMapper } from '../users/dto/users.mapper';
import { RestaurantsMapper } from '../restaurants/dto/restaurants.mapper';

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

  const VALID_SAVE_DTO: OrderSaveDto = {
    customerId: 1,
    courierId: 2,
    restaurantId: 1,
  };

  const VALID_UPDATE_DTO: OrderUpdateDto = {
    courierId: 2,
  };

  const ORDER_1: Order = {
    id: 1,
    customer: CUSTOMER,
    courier: COURIER,
    restaurant: {
      id: 1,
    } as Restaurant,
    status: Status.NEW,
    totalPrice: 100,
    createdAt: new Date(2026, 7, 21),
    items: [],
    active: true,
  };

  const ORDER_2: Order = {
    id: 2,
    customer: {
      id: 5,
      role: Role.CUSTOMER,
    } as User,
    courier: {
      id: 6,
      role: Role.COURIER,
    } as User,
    restaurant: {
      id: 2,
    } as Restaurant,
    status: Status.COMPLETED,
    totalPrice: 200,
    createdAt: new Date(2026, 7, 22),
    items: [],
    active: true,
  };

  let service: OrdersService;

  beforeEach(() => {
    ORDER_1.active = true;
    ORDER_1.status = Status.NEW;
    ORDER_2.active = true;
    ORDER_2.status = Status.COMPLETED;
    jest.clearAllMocks();
  });
  let repository: jest.Mocked<OrdersRepository>;
  let usersService: jest.Mocked<UsersService>;
  let restaurantsService: jest.Mocked<RestaurantsService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        UsersMapper,
        RestaurantsMapper,
        OrdersMapper,
        {
          provide: OrdersRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
            findByIdWithRelations: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
        {
          provide: RestaurantsService,
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    repository = module.get(OrdersRepository);
    usersService = module.get(UsersService);
    restaurantsService = module.get(RestaurantsService);

    repository.save.mockImplementation(
      async (entity: Order): Promise<Order> => entity,
    );

    repository.findAllActive.mockResolvedValue([ORDER_1, ORDER_2]);

    repository.findById.mockImplementation(
      async (id: number): Promise<Order | null> => {
        if (id === ORDER_1.id) {
          return ORDER_1;
        }

        if (id === ORDER_2.id) {
          return ORDER_2;
        }

        return null;
      },
    );

    repository.findByIdWithRelations.mockImplementation(
      async (id: number): Promise<Order | null> => {
        if (id === ORDER_1.id) {
          return ORDER_1;
        }

        if (id === ORDER_2.id) {
          return ORDER_2;
        }

        return null;
      },
    );

    usersService.getActiveEntityById.mockImplementation(
      async (id: number): Promise<User> => {
        if (id === CUSTOMER.id) {
          return CUSTOMER;
        }

        if (id === COURIER.id) {
          return COURIER;
        }

        throw new EntityNotFoundException(User.name, id);
      },
    );

    restaurantsService.getActiveEntityById.mockResolvedValue({
      id: 1,
    } as Restaurant);
  });

  describe('create', (): void => {
    it('should create an active NEW order for the authenticated customer without assigning a courier', async (): Promise<void> => {
      const result: OrderDto = await service.create(VALID_SAVE_DTO, CUSTOMER);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: CUSTOMER,
          restaurant: expect.objectContaining({ id: 1 }),
          courier: null,
          status: Status.NEW,
          active: true,
          totalPrice: 0,
        }),
      );

      expect(result.customer.id).toBe(CUSTOMER.id);
      expect(result.restaurant.id).toBe(1);
      expect(result.courier).toBeNull();
      expect(result.status).toBe(Status.NEW);
    });

    it('should propagate restaurant lookup errors and not save the order', async (): Promise<void> => {
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
      const result = await service.getAllOrders({
        id: ADMIN.id,
        role: Role.ADMIN,
      });

      expect(result).toHaveLength(2);
    });

    it('should return all active orders for manager', async (): Promise<void> => {
      const result = await service.getAllOrders({
        id: MANAGER.id,
        role: Role.MANAGER,
      });

      expect(result).toHaveLength(2);
    });

    it('should return only customer-owned orders for customer', async (): Promise<void> => {
      const result = await service.getAllOrders({
        id: CUSTOMER.id,
        role: Role.CUSTOMER,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ORDER_1.id);
    });

    it('should return only assigned orders for courier', async (): Promise<void> => {
      const result = await service.getAllOrders({
        id: COURIER.id,
        role: Role.COURIER,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ORDER_1.id);
    });

    it('should ignore unassigned orders for courier filtering', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([
        {
          ...ORDER_1,
          courier: null,
        } as Order,
      ]);

      await expect(
        service.getAllOrders({
          id: COURIER.id,
          role: Role.COURIER,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when there are no active orders', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(
        service.getAllOrders({
          id: ADMIN.id,
          role: Role.ADMIN,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the role has no accessible orders', async (): Promise<void> => {
      await expect(
        service.getAllOrders({
          id: 999,
          role: 'unknown' as Role,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when customer has no own orders', async (): Promise<void> => {
      await expect(
        service.getAllOrders({
          id: 999,
          role: Role.CUSTOMER,
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
      repository.findAllActive.mockResolvedValue([
        ORDER_1,
        {
          ...ORDER_2,
          status: Status.CANCELLED_CUSTOMER,
        } as Order,
        {
          ...ORDER_2,
          id: 3,
          status: Status.CANCELLED_COURIER,
        } as Order,
        {
          ...ORDER_2,
          id: 4,
          status: Status.COMPLETED,
        } as Order,
      ]);

      const result = await service.getCurrentOrders({
        id: ADMIN.id,
        role: Role.ADMIN,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ORDER_1.id);
    });

    it('should throw when all accessible orders are terminal', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([
        ORDER_2,
        {
          ...ORDER_2,
          id: 3,
          status: Status.CANCELLED_CUSTOMER,
        } as Order,
        {
          ...ORDER_2,
          id: 4,
          status: Status.CANCELLED_COURIER,
        } as Order,
      ]);

      await expect(
        service.getCurrentOrders({
          id: ADMIN.id,
          role: Role.ADMIN,
        }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getOrderById', (): void => {
    it('should return an order for an authorized admin', async (): Promise<void> => {
      const result = await service.getOrderById(ORDER_1.id, ADMIN);

      expect(result.id).toBe(ORDER_1.id);
    });

    it('should return an order for its customer', async (): Promise<void> => {
      const result = await service.getOrderById(ORDER_1.id, CUSTOMER);

      expect(result.id).toBe(ORDER_1.id);
    });

    it('should throw when a customer requests another customer order', async (): Promise<void> => {
      const otherCustomer = {
        id: 999,
        role: Role.CUSTOMER,
      } as User;

      await expect(
        service.getOrderById(ORDER_1.id, otherCustomer),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw when an unassigned courier requests an order', async (): Promise<void> => {
      const orderWithoutCourier = {
        ...ORDER_1,
        courier: null,
      } as Order;

      repository.findByIdWithRelations.mockResolvedValue(orderWithoutCourier);

      await expect(
        service.getOrderById(ORDER_1.id, COURIER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw when the order does not exist', async (): Promise<void> => {
      await expect(service.getOrderById(999, ADMIN)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('getActiveEntityById', (): void => {
    it('should return an active order', async (): Promise<void> => {
      const result = await service.getActiveEntityById(ORDER_1.id);

      expect(result).toBe(ORDER_1);
      expect(repository.findByIdWithRelations).toHaveBeenCalledWith(ORDER_1.id);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(service.getActiveEntityById(999)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue({
        ...ORDER_1,
        active: false,
      } as Order);

      await expect(
        service.getActiveEntityById(ORDER_1.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveEntityByIdWithRelations', (): void => {
    it('should return an active order with relations', async (): Promise<void> => {
      const result = await service.getActiveEntityByIdWithRelations(ORDER_1.id);

      expect(result).toBe(ORDER_1);
    });

    it('should throw when the related order is missing', async (): Promise<void> => {
      await expect(
        service.getActiveEntityByIdWithRelations(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the related order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue({
        ...ORDER_1,
        active: false,
      } as Order);

      await expect(
        service.getActiveEntityByIdWithRelations(ORDER_1.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getOrderByIdWithRelations', (): void => {
    it('should return an accessible order with relations', async (): Promise<void> => {
      const result = await service.getOrderByIdWithRelations(ORDER_1.id, ADMIN);

      expect(result.id).toBe(ORDER_1.id);
    });

    it('should reject an unauthorized customer', async (): Promise<void> => {
      await expect(
        service.getOrderByIdWithRelations(ORDER_1.id, {
          id: 999,
          role: Role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(
        service.getOrderByIdWithRelations(999, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue({
        ...ORDER_1,
        active: false,
      } as Order);

      await expect(
        service.getOrderByIdWithRelations(ORDER_1.id, ADMIN),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('getActiveOrderByIdWithRelations', (): void => {
    it('should return an active order DTO', async (): Promise<void> => {
      const result = await service.getActiveOrderByIdWithRelations(ORDER_1.id);

      expect(result.id).toBe(ORDER_1.id);
    });

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(
        service.getActiveOrderByIdWithRelations(999),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when the order is inactive', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue({
        ...ORDER_1,
        active: false,
      } as Order);

      await expect(
        service.getActiveOrderByIdWithRelations(ORDER_1.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('update', (): void => {
    it('should assign a courier and save the order', async (): Promise<void> => {
      const order = {
        ...ORDER_1,
        courier: null,
      } as Order;

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.update(ORDER_1.id, VALID_UPDATE_DTO);

      expect(usersService.getActiveEntityById).toHaveBeenCalledWith(
        VALID_UPDATE_DTO.courierId,
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ORDER_1.id,
          courier: COURIER,
        }),
      );
    });

    it('should assign a courier without changing a non-NEW order status', async (): Promise<void> => {
      const order = {
        ...ORDER_1,
        status: Status.ACCEPTED,
        courier: null,
      } as Order;

      repository.findByIdWithRelations.mockResolvedValue(order);

      await service.update(ORDER_1.id, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ORDER_1.id,
          courier: COURIER,
          status: Status.ACCEPTED,
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

    it('should throw when the order is missing', async (): Promise<void> => {
      await expect(
        service.update(999, VALID_UPDATE_DTO),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('deleteById', (): void => {
    it('should mark an active order inactive and save it', async (): Promise<void> => {
      await service.deleteById(ORDER_1.id);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ORDER_1.id,
          active: false,
        }),
      );
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
});
