import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { OrderItemsService } from './order-items.service';
import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';
import { OrderItemDto } from './dto/order-item.dto';

import { OrdersService } from '../orders/orders.service';
import { MenuItemsService } from '../menu-items/menu-items.service';

import { OrderItem } from './order-item.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { MenuItem } from '../menu-items/menu-item.entity';

import { Role } from '../users/enums/role.enum';
import { Status } from '../orders/enums/status.enum';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

describe('OrderItemsService', (): void => {
  let service: OrderItemsService;
  let repository: jest.Mocked<OrderItemsRepository>;
  let ordersService: jest.Mocked<OrdersService>;
  let menuItemsService: jest.Mocked<MenuItemsService>;
  let mapper: jest.Mocked<OrderItemsMapper>;

  const CUSTOMER: User = {
    id: 1,
    role: Role.CUSTOMER,
  } as User;

  const OTHER_CUSTOMER: User = {
    id: 2,
    role: Role.CUSTOMER,
  } as User;

  const COURIER: User = {
    id: 3,
    role: Role.COURIER,
  } as User;

  const OTHER_COURIER: User = {
    id: 4,
    role: Role.COURIER,
  } as User;

  const RESTAURANT = {
    id: 1,
  };

  const ORDER: Order = {
    id: 100,
    customer: CUSTOMER,
    courier: null,
    restaurant: RESTAURANT,
    status: Status.NEW,
    totalPrice: 0,
  } as Order;

  const MENU_ITEM: MenuItem = {
    id: 10,
    price: 10,
    menu: {
      restaurant: RESTAURANT,
    },
  } as MenuItem;

  const ORDER_ITEM: OrderItem = {
    id: 200,
    quantity: 2,
    active: true,
    menuItem: MENU_ITEM,
    order: ORDER,
  } as OrderItem;

  const SAVE_DTO: OrderItemSaveDto = {
    quantity: 2,
    menuItemId: MENU_ITEM.id,
    orderId: ORDER.id,
  };

  const UPDATE_DTO: OrderItemUpdateDto = {
    newQuantity: 5,
  };

  beforeEach(async (): Promise<void> => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllActive: jest.fn(),
    };

    mapper = {
      mapEntityToDto: jest.fn((entity: OrderItem) => ({
        id: entity?.id,
        quantity: entity?.quantity,
      })),
      mapDtoToEntity: jest.fn(() => {
        return {
          ...orderItem,
        } as OrderItem;
      }),
      mapEntityListToDtoList: jest.fn((entities: OrderItem[]) =>
        entities.map((entity: OrderItem) => ({
          id: entity.id,
          quantity: entity.quantity,
        })),
      ),
    };

    ordersService = {
      getActiveEntityByIdWithRelations: jest.fn(),
    };

    menuItemsService = {
      getActiveEntityById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderItemsService,
        {
          provide: OrderItemsRepository,
          useValue: {
            save: jest.fn(),
            findById: jest.fn(),
            findAllActive: jest.fn(),
            findAllActiveByOrderId: jest.fn(),
          },
        },
        {
          provide: OrderItemsMapper,
          useValue: {
            mapEntityToDto: jest.fn((entity: OrderItem): OrderItemDto => ({
              id: entity.id,
              quantity: entity.quantity,
              menuItem: entity.menuItem,
              order: entity.order,
            })),
            mapDtoToEntity: jest.fn(
              (dto: OrderItemSaveDto): OrderItem =>
                ({
                  quantity: dto.quantity,
                  active: true,
                }) as OrderItem,
            ),
            mapEntityListToDtoList: jest.fn(
              (entities: OrderItem[]): OrderItemDto[] =>
                entities.map((entity: OrderItem) => ({
                  id: entity.id,
                  quantity: entity.quantity,
                  menuItem: entity.menuItem,
                  order: entity.order,
                })),
            ),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            getActiveEntityByIdWithRelations: jest.fn(),
            updateTotalPrice: jest.fn(),
          },
        },
        {
          provide: MenuItemsService,
          useValue: {
            getActiveEntityWithRestaurantById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderItemsService>(OrderItemsService);
    repository = module.get(OrderItemsRepository);
    mapper = module.get(OrderItemsMapper);
    ordersService = module.get(OrdersService);
    menuItemsService = module.get(MenuItemsService);

    ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(ORDER);
    ordersService.updateTotalPrice.mockResolvedValue(undefined);

    menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
      MENU_ITEM,
    );

    repository.findAllActiveByOrderId.mockResolvedValue([]);
    repository.save.mockImplementation(
      async (entity: OrderItem): Promise<OrderItem> => entity,
    );

    repository.findAllActive.mockResolvedValue([ORDER_ITEM]);
    repository.findById.mockResolvedValue(ORDER_ITEM);

    jest.clearAllMocks();

    ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(ORDER);
    ordersService.updateTotalPrice.mockResolvedValue(undefined);

    menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
      MENU_ITEM,
    );

    repository.findAllActiveByOrderId.mockResolvedValue([]);
    repository.save.mockImplementation(
      async (entity: OrderItem): Promise<OrderItem> => entity,
    );
    repository.findAllActive.mockResolvedValue([ORDER_ITEM]);
    repository.findById.mockResolvedValue(ORDER_ITEM);
  });

  describe('create', (): void => {
    it('should create active order item and return dto', async (): Promise<void> => {
      const entity: OrderItem = {
        ...ORDER_ITEM,
        id: 201,
        quantity: SAVE_DTO.quantity,
        active: true,
      };

      mapper.mapDtoToEntity.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      const result = await service.create(SAVE_DTO, CUSTOMER);

      expect(
        ordersService.getActiveEntityByIdWithRelations,
      ).toHaveBeenCalledWith(SAVE_DTO.orderId);

      expect(
        menuItemsService.getActiveEntityWithRestaurantById,
      ).toHaveBeenCalledWith(SAVE_DTO.menuItemId);

      expect(repository.findAllActiveByOrderId).toHaveBeenCalledWith(ORDER.id);

      expect(entity.order).toBe(ORDER);
      expect(entity.menuItem).toBe(MENU_ITEM);
      expect(entity.active).toBe(true);

      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(ordersService.updateTotalPrice).toHaveBeenCalled();

      expect(result).toBeDefined();
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(entity);
    });

    it('should throw ForbiddenException when user has no access to the order', async (): Promise<void> => {
      const inaccessibleOrder: Order = {
        ...ORDER,
        customer: OTHER_CUSTOMER,
      } as Order;

      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(
        inaccessibleOrder,
      );

      await expect(service.create(SAVE_DTO, CUSTOMER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject menu item from another restaurant', async (): Promise<void> => {
      const anotherRestaurantMenuItem: MenuItem = {
        ...MENU_ITEM,
        menu: {
          restaurant: {
            id: 999,
          },
        },
      } as MenuItem;

      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        anotherRestaurantMenuItem,
      );

      await expect(service.create(SAVE_DTO, CUSTOMER)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject create when order is completed', async (): Promise<void> => {
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue({
        ...ORDER,
        status: Status.COMPLETED,
      } as Order);

      await expect(service.create(SAVE_DTO, CUSTOMER)).rejects.toThrow();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject create when maximum item count is reached', async (): Promise<void> => {
      const items: OrderItem[] = Array.from(
        { length: 20 },
        (_, index) =>
          ({
            ...ORDER_ITEM,
            id: index + 1,
          }) as OrderItem,
      );

      repository.findAllActiveByOrderId.mockResolvedValue(items);

      await expect(service.create(SAVE_DTO, CUSTOMER)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject create when order total exceeds the limit', async (): Promise<void> => {
      const expensiveItem: OrderItem = {
        ...ORDER_ITEM,
        quantity: 50,
        menuItem: {
          ...MENU_ITEM,
          price: 10,
        } as MenuItem,
      };

      repository.findAllActiveByOrderId.mockResolvedValue([expensiveItem]);

      await expect(service.create(SAVE_DTO, CUSTOMER)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllActiveOrderItems', (): void => {
    it('should return accessible order item DTOs', async (): Promise<void> => {
      const secondItem: OrderItem = {
        ...ORDER_ITEM,
        id: 201,
        menuItem: {
          ...MENU_ITEM,
          id: 11,
        } as MenuItem,
      };

      repository.findAllActive.mockResolvedValue([ORDER_ITEM, secondItem]);

      const result = await service.getAllActiveOrderItems(CUSTOMER);

      expect(repository.findAllActive).toHaveBeenCalledTimes(1);
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        ORDER_ITEM,
        secondItem,
      ]);

      expect(result).toHaveLength(2);
    });

    it('should filter out order items that the user cannot access', async (): Promise<void> => {
      const accessibleItem: OrderItem = {
        ...ORDER_ITEM,
        order: ORDER,
      };

      const inaccessibleItem: OrderItem = {
        ...ORDER_ITEM,
        id: 201,
        order: {
          ...ORDER,
          customer: OTHER_CUSTOMER,
        } as Order,
      };

      repository.findAllActive.mockResolvedValue([
        accessibleItem,
        inaccessibleItem,
      ]);

      const result = await service.getAllActiveOrderItems(CUSTOMER);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        accessibleItem,
      ]);

      expect(result).toHaveLength(1);
    });

    it('should throw EntityNotFoundException when no order items exist', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(
        service.getAllActiveOrderItems(CUSTOMER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when no order items are accessible', async (): Promise<void> => {
      const inaccessibleItem: OrderItem = {
        ...ORDER_ITEM,
        order: {
          ...ORDER,
          customer: OTHER_CUSTOMER,
        } as Order,
      };

      repository.findAllActive.mockResolvedValue([inaccessibleItem]);

      await expect(
        service.getAllActiveOrderItems(CUSTOMER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });
  });

  describe('getActiveOrderItemById', (): void => {
    it('should return accessible order item DTO', async (): Promise<void> => {
      repository.findById.mockResolvedValue(ORDER_ITEM);

      const result = await service.getActiveOrderItemById(
        ORDER_ITEM.id,
        CUSTOMER,
      );

      expect(repository.findById).toHaveBeenCalledWith(ORDER_ITEM.id);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(ORDER_ITEM);
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when user has no access to the order item', async (): Promise<void> => {
      const inaccessibleItem: OrderItem = {
        ...ORDER_ITEM,
        order: {
          ...ORDER,
          customer: OTHER_CUSTOMER,
        } as Order,
      };

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.getActiveOrderItemById(inaccessibleItem.id, CUSTOMER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });
  });

  describe('getActiveEntityById', (): void => {
    it('should return active order item', async (): Promise<void> => {
      repository.findById.mockResolvedValue(ORDER_ITEM);

      const result = await service.getActiveEntityById(ORDER_ITEM.id);

      expect(repository.findById).toHaveBeenCalledWith(ORDER_ITEM.id);
      expect(result).toBe(ORDER_ITEM);
    });

    it('should throw EntityNotFoundException when order item does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getActiveEntityById(ORDER_ITEM.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw EntityNotFoundException when order item is inactive', async (): Promise<void> => {
      const inactiveItem: OrderItem = {
        ...ORDER_ITEM,
        active: false,
      };

      repository.findById.mockResolvedValue(inactiveItem);

      await expect(
        service.getActiveEntityById(inactiveItem.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('update', (): void => {
    it('should update order item quantity', async (): Promise<void> => {
      const item: OrderItem = {
        ...ORDER_ITEM,
        quantity: 2,
      };

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId.mockResolvedValue([]);

      await service.update(item.id, UPDATE_DTO, CUSTOMER);

      expect(item.quantity).toBe(UPDATE_DTO.newQuantity);
      expect(repository.save).toHaveBeenCalledWith(item);
      expect(ordersService.updateTotalPrice).toHaveBeenCalled();
    });

    it('should exclude the current item when checking order total', async (): Promise<void> => {
      const item: OrderItem = {
        ...ORDER_ITEM,
        quantity: 2,
      };

      const otherItem: OrderItem = {
        ...ORDER_ITEM,
        id: 201,
        quantity: 1,
      };

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId.mockResolvedValue([item, otherItem]);

      await service.update(item.id, UPDATE_DTO, CUSTOMER);

      expect(repository.save).toHaveBeenCalledWith(item);
      expect(item.quantity).toBe(UPDATE_DTO.newQuantity);
    });

    it('should throw EntityNotFoundException when order item is not found', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(ORDER_ITEM.id, UPDATE_DTO, CUSTOMER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has no access to the order item', async (): Promise<void> => {
      const inaccessibleItem: OrderItem = {
        ...ORDER_ITEM,
        order: {
          ...ORDER,
          customer: OTHER_CUSTOMER,
        } as Order,
      };

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.update(inaccessibleItem.id, UPDATE_DTO, CUSTOMER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject update when order is completed', async (): Promise<void> => {
      const completedItem: OrderItem = {
        ...ORDER_ITEM,
        order: {
          ...ORDER,
          status: Status.COMPLETED,
        } as Order,
      };

      repository.findById.mockResolvedValue(completedItem);

      await expect(
        service.update(completedItem.id, UPDATE_DTO, CUSTOMER),
      ).rejects.toThrow();

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

    it('should reject update when order total exceeds the limit', async (): Promise<void> => {
      const item: OrderItem = {
        ...ORDER_ITEM,
        quantity: 2,
      };

      const expensiveOtherItem: OrderItem = {
        ...ORDER_ITEM,
        id: 201,
        quantity: 49,
      };

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId.mockResolvedValue([
        item,
        expensiveOtherItem,
      ]);

      await expect(
        service.update(item.id, UPDATE_DTO, CUSTOMER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteById', (): void => {
    it('should mark order item as inactive', async (): Promise<void> => {
      const item: OrderItem = {
        ...ORDER_ITEM,
        active: true,
      };

      repository.findById.mockResolvedValue(item);

      await service.deleteById(item.id, CUSTOMER);

      expect(item.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(item);
      expect(ordersService.updateTotalPrice).toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when order item is not found', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.deleteById(ORDER_ITEM.id, CUSTOMER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has no access to the order item', async (): Promise<void> => {
      const inaccessibleItem: OrderItem = {
        ...ORDER_ITEM,
        order: {
          ...ORDER,
          customer: OTHER_CUSTOMER,
        } as Order,
      };

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.deleteById(inaccessibleItem.id, CUSTOMER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject delete when order is completed', async (): Promise<void> => {
      const completedItem: OrderItem = {
        ...ORDER_ITEM,
        order: {
          ...ORDER,
          status: Status.COMPLETED,
        } as Order,
      };

      repository.findById.mockResolvedValue(completedItem);

      await expect(
        service.deleteById(completedItem.id, CUSTOMER),
      ).rejects.toThrow();

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', (): void => {
    it('should restore an inactive order item', async (): Promise<void> => {
      const inactiveItem: OrderItem = {
        ...ORDER_ITEM,
        active: false,
      };

      repository.findById.mockResolvedValue(inactiveItem);
      repository.findAllActiveByOrderId.mockResolvedValue([]);

      await service.restoreById(inactiveItem.id, CUSTOMER);

      expect(inactiveItem.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(inactiveItem);
      expect(ordersService.updateTotalPrice).toHaveBeenCalled();
    });

    it('should do nothing when the order item is already active', async (): Promise<void> => {
      const activeItem: OrderItem = {
        ...ORDER_ITEM,
        active: true,
      };

      repository.findById.mockResolvedValue(activeItem);

      await service.restoreById(activeItem.id, CUSTOMER);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when order item does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.restoreById(ORDER_ITEM.id, CUSTOMER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has no access to the order item', async (): Promise<void> => {
      const inaccessibleItem: OrderItem = {
        ...ORDER_ITEM,
        active: false,
        order: {
          ...ORDER,
          customer: OTHER_CUSTOMER,
        } as Order,
      };

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.restoreById(inaccessibleItem.id, CUSTOMER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject restore when order is completed', async (): Promise<void> => {
      const inactiveItem: OrderItem = {
        ...ORDER_ITEM,
        active: false,
        order: {
          ...ORDER,
          status: Status.COMPLETED,
        } as Order,
      };

      repository.findById.mockResolvedValue(inactiveItem);

      await expect(
        service.restoreById(inactiveItem.id, CUSTOMER),
      ).rejects.toThrow();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject restore when maximum item count is reached', async (): Promise<void> => {
      const inactiveItem: OrderItem = {
        ...ORDER_ITEM,
        active: false,
      };

      const activeItems: OrderItem[] = Array.from(
        { length: 20 },
        (_, index) =>
          ({
            ...ORDER_ITEM,
            id: index + 1,
            active: true,
          }) as OrderItem,
      );

      repository.findById.mockResolvedValue(inactiveItem);
      repository.findAllActiveByOrderId.mockResolvedValue(activeItems);

      await expect(
        service.restoreById(inactiveItem.id, CUSTOMER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('courier access', (): void => {
    it('should allow assigned courier to access the order item', async (): Promise<void> => {
      const courierOrder: Order = {
        ...ORDER,
        courier: COURIER,
      } as Order;

      const item: OrderItem = {
        ...ORDER_ITEM,
        order: courierOrder,
      };

      repository.findById.mockResolvedValue(item);

      const result = await service.getActiveOrderItemById(item.id, COURIER);

      expect(result).toBeDefined();
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(item);
    });

    it('should reject a different courier', async (): Promise<void> => {
      const courierOrder: Order = {
        ...ORDER,
        courier: COURIER,
      } as Order;

      const item: OrderItem = {
        ...ORDER_ITEM,
        order: courierOrder,
      };

      repository.findById.mockResolvedValue(item);

      await expect(
        service.getActiveOrderItemById(item.id, OTHER_COURIER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
