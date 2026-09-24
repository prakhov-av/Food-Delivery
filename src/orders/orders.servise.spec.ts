import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
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

  let service: OrdersService;
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

    repository.findAllActive.mockResolvedValue([
      VALID_ENTITY_TO_MOCK_RETURN_1,
      VALID_ENTITY_TO_MOCK_RETURN_2,
    ]);

    repository.save.mockImplementation(
      async (entity: Order): Promise<Order> => entity,
    );

    repository.findById.mockImplementation(
      async (id: number): Promise<Order | null> => {
        if (id === 1) {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        if (id === 2) {
          return VALID_ENTITY_TO_MOCK_RETURN_2;
        }

        return null;
      },
    );

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

    restaurantsService.getActiveEntityById.mockResolvedValue({
      id: 1,
    } as Restaurant);
  });

  describe('create', (): void => {
    it('should create active order and return dto', async (): Promise<void> => {
      const user: User = {
        id: 1,
        role: Role.CUSTOMER,
      } as User;

      const result: OrderDto = await service.create(VALID_SAVE_DTO, user);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: true }),
      );

      expect(result).toBeDefined();
      expect(result.restaurant.id).toEqual(VALID_SAVE_DTO.restaurantId);
      expect(result.customer.id).toEqual(user.id);
      expect(result.courier).toBeNull();
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
  });
});
