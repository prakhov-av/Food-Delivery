import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { RoleMismatchException } from '../exceptions/types/role-mismatch.exception';
import { Restaurant } from '../restaurants/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { OrderSaveDto } from './dto/order.save-dto';
import { Status } from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { Order } from './order.entity';
import { OrderDto } from './dto/order.dto';
import { OrdersMapper } from './dto/orders.mapper';
import { UsersService } from '../users/users.service';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/user.entity';
import { UsersMapper } from '../users/dto/users.mapper';
import { RestaurantsMapper } from '../restaurants/dto/restaurants.mapper';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.enums';
import { MAX_SUBMITTED_ORDERS_PER_CUSTOMER } from './validation/order-limits';

describe('OrdersService', (): void => {
  const VALID_SAVE_DTO: OrderSaveDto = {
    customerId: 1,
    restaurantId: 1,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_1: Order = {
    id: 1,
    customer: {
      id: 1,
    } as User,
    courier: null,
    restaurant: {
      id: 1,
    } as Restaurant,
    status: Status.NEW,
    totalPrice: 100,
    createdAt: new Date(2026, 7, 21),
    items: [],
    active: true,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_2: Order = {
    id: 2,
    customer: {
      id: 2,
    } as User,
    courier: null,
    restaurant: {
      id: 2,
    } as Restaurant,
    status: Status.NEW,
    totalPrice: 200,
    createdAt: new Date(2026, 7, 22),
    items: [],
    active: true,
  };

  const VALID_UPDATE_DTO: OrderUpdateDto = {
    courierId: 2,
  };

  // Свежий заказ для тестов, которые меняют объект.
  const makeOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 1,
    customer: { id: 1 } as User,
    courier: null,
    restaurant: { id: 1 } as Restaurant,
    status: Status.NEW,
    totalPrice: 0,
    createdAt: new Date(2026, 7, 21),
    items: [],
    active: true,
    ...overrides,
  });

  let service: OrdersService;
  let repository: jest.Mocked<OrdersRepository>;
  let usersService: jest.Mocked<UsersService>;
  let restaurantsService: jest.Mocked<RestaurantsService>;
  let audit: jest.Mocked<AuditService>;

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
            findActiveDraft: jest.fn(),
            countActiveItems: jest.fn(),
            countSubmittedByCustomerId: jest.fn(),
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
    usersService = module.get(UsersService);
    restaurantsService = module.get(RestaurantsService);
    audit = module.get(AuditService);

    repository.findAllActive.mockResolvedValue([
      VALID_ENTITY_TO_MOCK_RETURN_1,
      VALID_ENTITY_TO_MOCK_RETURN_2,
    ]);

    repository.save.mockImplementation(
      async (entity: Order): Promise<Order> => entity,
    );

    const findOrderById = async (id: number): Promise<Order | null> => {
      if (id === 1) {
        return VALID_ENTITY_TO_MOCK_RETURN_1;
      }

      if (id === 2) {
        return VALID_ENTITY_TO_MOCK_RETURN_2;
      }

      return null;
    };

    repository.findById.mockImplementation(findOrderById);
    repository.findByIdWithRelations.mockImplementation(findOrderById);

    repository.findActiveDraft.mockResolvedValue(null);
    repository.countActiveItems.mockResolvedValue(1);
    repository.countSubmittedByCustomerId.mockResolvedValue(0);

    usersService.getActiveEntityById.mockImplementation(
      async (id: number): Promise<User> => {
        if (id === 1) {
          return {
            id: 1,
            role: Role.CUSTOMER,
          } as User;
        }

        if (id === 2) {
          return {
            id: 2,
            role: Role.COURIER,
          } as User;
        }

        throw new EntityNotFoundException(User.name, id);
      },
    );

    usersService.findAvailableCourier.mockResolvedValue(null);

    restaurantsService.getActiveEntityById.mockResolvedValue({
      id: 1,
    } as Restaurant);
  });

  describe('create', (): void => {
    const user: User = {
      id: 1,
      role: Role.CUSTOMER,
    } as User;

    it('should create active order and return dto', async (): Promise<void> => {
      const result: OrderDto = await service.create(VALID_SAVE_DTO, user);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: true }),
      );

      expect(result).toBeDefined();
      expect(result.restaurant.id).toEqual(VALID_SAVE_DTO.restaurantId);
      expect(result.customer.id).toEqual(user.id);
      expect(result.courier).toBeNull();
    });

    it('should write an audit record when an order is created', async (): Promise<void> => {
      await service.create(VALID_SAVE_DTO, user);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_CREATED,
          actorId: user.id,
        }),
      );
    });

    it('should return the existing draft instead of creating a new order', async (): Promise<void> => {
      repository.findActiveDraft.mockResolvedValue(
        VALID_ENTITY_TO_MOCK_RETURN_1,
      );

      const result: OrderDto = await service.create(VALID_SAVE_DTO, user);

      expect(result.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(repository.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('getAllOrders', (): void => {
    it('should return list of order DTOs', async (): Promise<void> => {
      const user: Pick<User, 'id' | 'role'> = {
        id: 1,
        role: Role.ADMIN,
      };

      const result: OrderDto[] = await service.getAllOrders(user);

      expect(result).toBeDefined();
      expect(result.length).toEqual(2);

      const dto1: OrderDto = result[0];
      expect(dto1).toBeDefined();
      expect(dto1.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(dto1.customer).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.customer);
      expect(dto1.courier).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.courier);
      expect(dto1.restaurant).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.restaurant);
      expect(dto1.status).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.status);
      expect(dto1.totalPrice).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.totalPrice);
      expect(dto1.createdAt).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.createdAt);

      const dto2: OrderDto = result[1];
      expect(dto2).toBeDefined();
      expect(dto2.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.id);
      expect(dto2.customer).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.customer);
      expect(dto2.courier).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.courier);
      expect(dto2.restaurant).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.restaurant);
      expect(dto2.status).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.status);
      expect(dto2.totalPrice).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.totalPrice);
      expect(dto2.createdAt).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.createdAt);
    });

    it('should throw error if list of orders is empty', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);

      const user: Pick<User, 'id' | 'role'> = {
        id: 1,
        role: Role.ADMIN,
      };

      const resultPromise: Promise<OrderDto[]> = service.getAllOrders(user);

      await expect(resultPromise).rejects.toThrow('not a single');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should return only own orders for a customer', async (): Promise<void> => {
      const user: Pick<User, 'id' | 'role'> = {
        id: 1,
        role: Role.CUSTOMER,
      };

      const result: OrderDto[] = await service.getAllOrders(user);

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(1);
    });

    it('should throw when a courier has no assigned orders', async (): Promise<void> => {
      const user: Pick<User, 'id' | 'role'> = {
        id: 99,
        role: Role.COURIER,
      };

      await expect(service.getAllOrders(user)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update order courier', async (): Promise<void> => {
      const idToUpdate: number = 1;
      await service.update(idToUpdate, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: idToUpdate,
          courier: expect.objectContaining({
            id: VALID_UPDATE_DTO.courierId,
          }),
        }),
      );
    });

    it('should throw exception when order is not found', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.update(
        1000000000000000,
        VALID_UPDATE_DTO,
      );

      await expect(resultPromise).rejects.toThrow('not found');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should reject a courier id that belongs to a non-courier user', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.update(1, {
        courierId: 1,
      });

      await expect(resultPromise).rejects.toBeInstanceOf(RoleMismatchException);
    });

    it('should reject an update without courier id', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.update(
        1,
        {} as OrderUpdateDto,
      );

      await expect(resultPromise).rejects.toBeInstanceOf(EntityUpdateException);
    });
  });

  describe('updateTotalPrice', (): void => {
    it('should save the new total price', async (): Promise<void> => {
      await service.updateTotalPrice(1, 42.5);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, totalPrice: 42.5 }),
      );
    });
  });

  describe('setStatus', (): void => {
    const customer: User = { id: 1, role: Role.CUSTOMER } as User;
    const manager: User = { id: 5, role: Role.MANAGER } as User;

    it('should reject setting the same status', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());

      await expect(
        service.setStatus(1, Status.NEW, customer),
      ).rejects.toBeInstanceOf(EntityUpdateException);
    });

    it('should deny a customer access to another customer order', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({ customer: { id: 2 } as User }),
      );

      await expect(
        service.setStatus(1, Status.CREATED, customer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should not let a customer move an order forward', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({ status: Status.CREATED }),
      );

      await expect(
        service.setStatus(1, Status.ACCEPTED, customer),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should not submit an empty order', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());
      repository.countActiveItems.mockResolvedValue(0);

      await expect(
        service.setStatus(1, Status.CREATED, customer),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should not submit when the limit of active orders is reached', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());
      repository.countSubmittedByCustomerId.mockResolvedValue(
        MAX_SUBMITTED_ORDERS_PER_CUSTOMER,
      );

      await expect(
        service.setStatus(1, Status.CREATED, customer),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should submit an order, assign a courier automatically and write audit records', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());
      usersService.findAvailableCourier.mockResolvedValue({
        id: 7,
        role: Role.COURIER,
      } as User);

      await service.setStatus(1, Status.CREATED, customer);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: Status.CREATED,
          courier: expect.objectContaining({ id: 7 }),
        }),
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_STATUS_CHANGED,
          actorId: customer.id,
          entityId: 1,
          details: { from: Status.NEW, to: Status.CREATED },
        }),
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ORDER_COURIER_ASSIGNED,
          entityId: 1,
          details: { courierId: 7, mode: 'AUTO' },
        }),
      );
    });

    it('should submit an order without a courier when none is available', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(makeOrder());

      await service.setStatus(1, Status.CREATED, customer);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.CREATED, courier: null }),
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.ORDER_STATUS_CHANGED }),
      );

      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.ORDER_COURIER_ASSIGNED }),
      );
    });

    it('should let a manager accept a submitted order without assigning a courier', async (): Promise<void> => {
      repository.findByIdWithRelations.mockResolvedValue(
        makeOrder({ status: Status.CREATED }),
      );

      await service.setStatus(1, Status.ACCEPTED, manager);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.ACCEPTED }),
      );

      expect(usersService.findAvailableCourier).not.toHaveBeenCalled();
    });
  });
});
