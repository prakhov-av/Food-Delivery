import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';

import { OrderItemsService } from './order-items.service';
import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrdersService } from '../orders/orders.service';
import { MenuItemsService } from '../menu-items/menu-items.service';

import { OrderItem } from './order-item.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { MenuItem } from '../menu-items/menu-item.entity';

import { Role } from '../users/enums/role.enum';
import { Status } from '../orders/enums/status.enum';

import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

describe('OrderItemsService', () => {
  let service: OrderItemsService;

  let repository: {
    save: jest.Mock;
    findById: jest.Mock;
    findAllActive: jest.Mock;
  };

  let mapper: {
    mapEntityToDto: jest.Mock;
    mapDtoToEntity: jest.Mock;
    mapEntityListToDtoList: jest.Mock;
  };

  let ordersService: {
    getActiveEntityByIdWithRelations: jest.Mock;
  };

  let menuItemsService: {
    getActiveEntityById: jest.Mock;
  };

  const customer: User = {
    id: 1,
    role: Role.CUSTOMER,
  } as User;

  const otherCustomer: User = {
    id: 2,
    role: Role.CUSTOMER,
  } as User;

  const courier: User = {
    id: 3,
    role: Role.COURIER,
  } as User;

  const otherCourier: User = {
    id: 4,
    role: Role.COURIER,
  } as User;

  const menuItem: MenuItem = {
    id: 10,
  } as MenuItem;

  const order: Order = {
    id: 100,
    customer,
    courier: null,
    status: Status.NEW,
  } as Order;

  const orderItem: OrderItem = {
    id: 200,
    quantity: 2,
    active: true,
    menuItem,
    order,
  } as OrderItem;

  const createDto = {
    quantity: 2,
    menuItemId: 10,
    orderId: 100,
  } as any;

  const updateDto = {
    newQuantity: 5,
  } as any;

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
          provide: OrderItemsMapper,
          useValue: mapper,
        },
        {
          provide: OrderItemsRepository,
          useValue: repository,
        },
        {
          provide: OrdersService,
          useValue: ordersService,
        },
        {
          provide: MenuItemsService,
          useValue: menuItemsService,
        },
      ],
    }).compile();

    service = module.get<OrderItemsService>(OrderItemsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create active order item and return dto', async () => {
      const entity: OrderItem = {
        ...orderItem,
        active: true,
      };

      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityById.mockResolvedValue(menuItem);
      mapper.mapDtoToEntity.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      const result = await service.create(createDto, customer);

      expect(
        ordersService.getActiveEntityByIdWithRelations,
      ).toHaveBeenCalledWith(createDto.orderId);

      expect(mapper.mapDtoToEntity).toHaveBeenCalledWith(createDto);

      expect(entity.order).toBe(order);
      expect(entity.active).toBe(true);

      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(entity);

      expect(result).toEqual({
        id: entity.id,
        quantity: entity.quantity,
      });
    });

    it('should throw ForbiddenException when user has no access to the order', async () => {
      const inaccessibleOrder: Order = {
        ...order,
        customer: otherCustomer,
        courier: null,
      } as Order;

      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(
        inaccessibleOrder,
      );

      await expect(service.create(createDto, customer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllActiveOrderItems', () => {
    it('should return accessible order item DTOs', async () => {
      const firstItem = {
        ...orderItem,
        order,
      } as OrderItem;

      const secondItem = {
        ...orderItem,
        id: 201,
        order: {
          ...order,
          id: 101,
        },
      } as OrderItem;

      repository.findAllActive.mockResolvedValue([firstItem, secondItem]);

      const result = await service.getAllActiveOrderItems(customer);

      expect(repository.findAllActive).toHaveBeenCalled();
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        firstItem,
        secondItem,
      ]);

      expect(result).toEqual([
        {
          id: firstItem.id,
          quantity: firstItem.quantity,
        },
        {
          id: secondItem.id,
          quantity: secondItem.quantity,
        },
      ]);
    });

    it('should filter out order items that the user cannot access', async () => {
      const accessibleItem = {
        ...orderItem,
        id: 200,
        order: {
          ...order,
          customer,
          courier: null,
        },
      } as OrderItem;

      const inaccessibleItem = {
        ...orderItem,
        id: 201,
        order: {
          ...order,
          customer: otherCustomer,
          courier: null,
        },
      } as OrderItem;

      repository.findAllActive.mockResolvedValue([
        accessibleItem,
        inaccessibleItem,
      ]);

      const result = await service.getAllActiveOrderItems(customer);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        accessibleItem,
      ]);

      expect(result).toEqual([
        {
          id: accessibleItem.id,
          quantity: accessibleItem.quantity,
        },
      ]);
    });

    it('should throw EntityNotFoundException when no order items exist', async () => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(
        service.getAllActiveOrderItems(customer),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when no order items are accessible', async () => {
      const inaccessibleItem = {
        ...orderItem,
        order: {
          ...order,
          customer: otherCustomer,
          courier: null,
        },
      } as OrderItem;

      repository.findAllActive.mockResolvedValue([inaccessibleItem]);

      await expect(
        service.getAllActiveOrderItems(customer),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });
  });

  describe('getActiveOrderItemById', () => {
    it('should return accessible order item DTO', async () => {
      const accessibleItem = {
        ...orderItem,
        order,
      } as OrderItem;

      repository.findById.mockResolvedValue(accessibleItem);

      const result = await service.getActiveOrderItemById(
        accessibleItem.id,
        customer,
      );

      expect(repository.findById).toHaveBeenCalledWith(accessibleItem.id);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(accessibleItem);

      expect(result).toEqual({
        id: accessibleItem.id,
        quantity: accessibleItem.quantity,
      });
    });

    it('should throw ForbiddenException when user has no access to the order item', async () => {
      const inaccessibleItem = {
        ...orderItem,
        order: {
          ...order,
          customer: otherCustomer,
          courier: null,
        },
      } as OrderItem;

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.getActiveOrderItemById(inaccessibleItem.id, customer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });
  });

  describe('getActiveEntityById', () => {
    it('should return active order item', async () => {
      const activeItem = {
        ...orderItem,
        active: true,
      } as OrderItem;

      repository.findById.mockResolvedValue(activeItem);

      const result = await service.getActiveEntityById(activeItem.id);

      expect(repository.findById).toHaveBeenCalledWith(activeItem.id);
      expect(result).toBe(activeItem);
    });

    it('should throw EntityNotFoundException when order item does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getActiveEntityById(orderItem.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw EntityNotFoundException when order item is inactive', async () => {
      const inactiveItem = {
        ...orderItem,
        active: false,
      } as OrderItem;

      repository.findById.mockResolvedValue(inactiveItem);

      await expect(
        service.getActiveEntityById(inactiveItem.id),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('update', () => {
    it('should update order item quantity', async () => {
      const item = {
        ...orderItem,
        quantity: 2,
        active: true,
        order,
      } as OrderItem;

      repository.findById.mockResolvedValue(item);
      repository.save.mockResolvedValue(item);

      await service.update(item.id, updateDto, customer);

      expect(item.quantity).toBe(updateDto.newQuantity);
      expect(repository.save).toHaveBeenCalledWith(item);
    });

    it('should throw EntityNotFoundException when order item is not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(orderItem.id, updateDto, customer),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has no access to the order item', async () => {
      const inaccessibleItem = {
        ...orderItem,
        order: {
          ...order,
          customer: otherCustomer,
          courier: null,
        },
      } as OrderItem;

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.update(inaccessibleItem.id, updateDto, customer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteById', () => {
    it('should mark order item as inactive', async () => {
      const item = {
        ...orderItem,
        active: true,
        order,
      } as OrderItem;

      repository.findById.mockResolvedValue(item);
      repository.save.mockResolvedValue(item);

      await service.deleteById(item.id, customer);

      expect(item.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(item);
    });

    it('should throw EntityNotFoundException when order item is not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.deleteById(orderItem.id, customer),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has no access to the order item', async () => {
      const inaccessibleItem = {
        ...orderItem,
        order: {
          ...order,
          customer: otherCustomer,
          courier: null,
        },
      } as OrderItem;

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.deleteById(inaccessibleItem.id, customer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', () => {
    it('should restore an inactive order item', async () => {
      const inactiveItem = {
        ...orderItem,
        active: false,
        order,
      } as OrderItem;

      repository.findById.mockResolvedValue(inactiveItem);
      repository.save.mockResolvedValue(inactiveItem);

      await service.restoreById(inactiveItem.id, customer);

      expect(inactiveItem.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(inactiveItem);
    });

    it('should do nothing when the order item is already active', async () => {
      const activeItem = {
        ...orderItem,
        active: true,
        order,
      } as OrderItem;

      repository.findById.mockResolvedValue(activeItem);

      await service.restoreById(activeItem.id, customer);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when order item does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.restoreById(orderItem.id, customer),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has no access to the order item', async () => {
      const inaccessibleItem = {
        ...orderItem,
        active: false,
        order: {
          ...order,
          customer: otherCustomer,
          courier: null,
        },
      } as OrderItem;

      repository.findById.mockResolvedValue(inaccessibleItem);

      await expect(
        service.restoreById(inaccessibleItem.id, customer),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('courier access', () => {
    it('should allow assigned courier to access the order item', async () => {
      const courierOrder: Order = {
        ...order,
        courier,
      } as Order;

      const item = {
        ...orderItem,
        order: courierOrder,
        active: true,
      } as OrderItem;

      repository.findById.mockResolvedValue(item);

      const result = await service.getActiveOrderItemById(item.id, courier);

      expect(result).toEqual({
        id: item.id,
        quantity: item.quantity,
      });
    });

    it('should reject a different courier', async () => {
      const courierOrder: Order = {
        ...order,
        courier,
      } as Order;

      const item = {
        ...orderItem,
        order: courierOrder,
        active: true,
      } as OrderItem;

      repository.findById.mockResolvedValue(item);

      await expect(
        service.getActiveOrderItemById(item.id, otherCourier),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
