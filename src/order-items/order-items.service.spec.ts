import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { OrderItemsService } from './order-items.service';
import { OrderItemsRepository } from './order-items.repository';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrdersService } from '../orders/orders.service';
import { MenuItemsService } from '../menu-items/menu-items.service';

import { OrderItem } from './order-item.entity';
import { Order } from '../orders/order.entity';
import { MenuItem } from '../menu-items/menu-item.entity';
import { User } from '../users/user.entity';

import { Role } from '../users/enums/role.enum';
import { Status } from '../orders/enums/status.enum';
import {
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
} from '../orders/validation/order-limits';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

describe('OrderItemsService', () => {
  let service: OrderItemsService;

  let repository: {
    save: jest.Mock;
    findById: jest.Mock;
    findAllActive: jest.Mock;
    findAllActiveByOrderId: jest.Mock;
  };

  let mapper: {
    mapDtoToEntity: jest.Mock;
    mapEntityToDto: jest.Mock;
    mapEntityListToDtoList: jest.Mock;
  };

  let ordersService: {
    getActiveEntityByIdWithRelations: jest.Mock;
    updateTotalPrice: jest.Mock;
  };

  let menuItemsService: {
    getActiveEntityWithRestaurantById: jest.Mock;
  };

  const createUser = (id: number, role: Role): Pick<User, 'id' | 'role'> => ({
    id,
    role,
  });

  const createRestaurant = (id = 1) => ({
    id,
  });

  const createOrder = (
    id = 1,
    status: Status = Status.NEW,
    customerId = 1,
    courierId?: number,
    restaurantId = 1,
  ): Order =>
    ({
      id,
      status,
      customer: { id: customerId },
      courier: courierId ? { id: courierId } : null,
      restaurant: createRestaurant(restaurantId),
    }) as Order;

  const createMenuItem = (id = 1, price = 10, restaurantId = 1): MenuItem =>
    ({
      id,
      price,
      menu: {
        restaurant: createRestaurant(restaurantId),
      },
    }) as MenuItem;

  const createOrderItem = (
    id = 1,
    order: Order = createOrder(),
    menuItem: MenuItem = createMenuItem(),
    quantity = 2,
    active = true,
  ): OrderItem =>
    ({
      id,
      order,
      menuItem,
      quantity,
      active,
    }) as OrderItem;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllActive: jest.fn(),
      findAllActiveByOrderId: jest.fn(),
    };

    mapper = {
      mapDtoToEntity: jest.fn(),
      mapEntityToDto: jest.fn(),
      mapEntityListToDtoList: jest.fn(),
    };

    ordersService = {
      getActiveEntityByIdWithRelations: jest.fn(),
      updateTotalPrice: jest.fn(),
    };

    menuItemsService = {
      getActiveEntityWithRestaurantById: jest.fn(),
    };

    service = new OrderItemsService(
      repository as unknown as OrderItemsRepository,
      mapper as unknown as OrderItemsMapper,
      ordersService as unknown as OrdersService,
      menuItemsService as unknown as MenuItemsService,
    );
  });

  describe('create', () => {
    it('should create active order item and return dto', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const menuItem = createMenuItem(5, 12, 1);
      const entity = createOrderItem(10, order, menuItem, 2, false);
      const dto = {
        orderId: 1,
        menuItemId: 5,
        quantity: 2,
      };
      const resultDto = {
        id: 10,
        orderId: 1,
        menuItem,
        quantity: 2,
      };

      mapper.mapDtoToEntity.mockReturnValue(entity);
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );
      repository.findAllActiveByOrderId.mockResolvedValue([]);
      repository.save.mockResolvedValue(entity);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);
      repository.findAllActiveByOrderId
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([entity]);
      mapper.mapEntityToDto.mockReturnValue(resultDto);

      const result = await service.create(dto, user as User);

      expect(mapper.mapDtoToEntity).toHaveBeenCalledWith(dto);
      expect(
        ordersService.getActiveEntityByIdWithRelations,
      ).toHaveBeenCalledWith(1);
      expect(
        menuItemsService.getActiveEntityWithRestaurantById,
      ).toHaveBeenCalledWith(5);
      expect(entity.order).toBe(order);
      expect(entity.menuItem).toBe(menuItem);
      expect(entity.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(ordersService.updateTotalPrice).toHaveBeenCalledWith(1, 24);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(entity);
      expect(result).toBe(resultDto);
    });

    it('should reject creation when order does not belong to customer', async () => {
      const user = createUser(99, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const menuItem = createMenuItem();

      mapper.mapDtoToEntity.mockReturnValue(createOrderItem());
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );

      await expect(
        service.create(
          { orderId: 1, menuItemId: 1, quantity: 1 },
          user as User,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject creation for a customer when order is not NEW', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.ACCEPTED, 1);

      mapper.mapDtoToEntity.mockReturnValue(createOrderItem());
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);

      await expect(
        service.create(
          { orderId: 1, menuItemId: 1, quantity: 1 },
          user as User,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        menuItemsService.getActiveEntityWithRestaurantById,
      ).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject creation when menu item belongs to another restaurant', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1, undefined, 1);
      const menuItem = createMenuItem(2, 10, 2);

      mapper.mapDtoToEntity.mockReturnValue(createOrderItem());
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );
      repository.findAllActiveByOrderId.mockResolvedValue([]);

      await expect(
        service.create(
          { orderId: 1, menuItemId: 2, quantity: 1 },
          user as User,
        ),
      ).rejects.toThrow('Menu item id 2 does not belong to restaurant id 1');

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject creation when order already has maximum number of items', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder();
      const menuItem = createMenuItem();
      const activeItems = Array.from({ length: MAX_ITEMS_PER_ORDER }, (_, i) =>
        createOrderItem(i + 1, order, menuItem, 1),
      );

      mapper.mapDtoToEntity.mockReturnValue(createOrderItem());
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );
      repository.findAllActiveByOrderId.mockResolvedValue(activeItems);

      await expect(
        service.create(
          { orderId: 1, menuItemId: 1, quantity: 1 },
          user as User,
        ),
      ).rejects.toThrow(
        `Order id 1 cannot contain more than ${MAX_ITEMS_PER_ORDER} items`,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject creation when order total exceeds the limit', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder();
      const menuItem = createMenuItem(2, 10, 1);
      const activeItem = createOrderItem(1, order, createMenuItem(1, 10), 50);

      mapper.mapDtoToEntity.mockReturnValue(createOrderItem());
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );
      repository.findAllActiveByOrderId.mockResolvedValue([activeItem]);

      await expect(
        service.create(
          { orderId: 1, menuItemId: 2, quantity: 2 },
          user as User,
        ),
      ).rejects.toThrow(`Order id 1 total cannot exceed ${MAX_ORDER_TOTAL}`);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow manager to create an order item', async () => {
      const user = createUser(10, Role.MANAGER);
      const order = createOrder(1, Status.ACCEPTED, 1);
      const menuItem = createMenuItem(5, 15, 1);
      const entity = createOrderItem(10, order, menuItem, 2, false);

      mapper.mapDtoToEntity.mockReturnValue(entity);
      ordersService.getActiveEntityByIdWithRelations.mockResolvedValue(order);
      menuItemsService.getActiveEntityWithRestaurantById.mockResolvedValue(
        menuItem,
      );
      repository.findAllActiveByOrderId
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([entity]);
      repository.save.mockResolvedValue(entity);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);
      mapper.mapEntityToDto.mockReturnValue({ id: 10 });

      await expect(
        service.create(
          { orderId: 1, menuItemId: 5, quantity: 2 },
          user as User,
        ),
      ).resolves.toEqual({ id: 10 });

      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(ordersService.updateTotalPrice).toHaveBeenCalledWith(1, 30);
    });
  });

  describe('getAllActiveOrderItems', () => {
    it('should return accessible active order items', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const ownOrder = createOrder(1, Status.NEW, 1);
      const foreignOrder = createOrder(2, Status.NEW, 2);

      const ownItem = createOrderItem(
        1,
        ownOrder,
        createMenuItem(1, 10),
        2,
        true,
      );
      const foreignItem = createOrderItem(
        2,
        foreignOrder,
        createMenuItem(2, 20),
        1,
        true,
      );

      repository.findAllActive.mockResolvedValue([ownItem, foreignItem]);
      mapper.mapEntityListToDtoList.mockReturnValue([{ id: 1 }]);

      const result = await service.getAllActiveOrderItems(user as User);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([ownItem]);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should ignore inactive order items', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const ownOrder = createOrder(1, Status.NEW, 1);
      const inactiveItem = createOrderItem(
        1,
        ownOrder,
        createMenuItem(),
        1,
        false,
      );

      repository.findAllActive.mockResolvedValue([inactiveItem]);

      await expect(
        service.getAllActiveOrderItems(user as User),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });

    it('should throw not found when user has no accessible order items', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const foreignOrder = createOrder(2, Status.NEW, 2);
      const foreignItem = createOrderItem(
        1,
        foreignOrder,
        createMenuItem(),
        1,
        true,
      );

      repository.findAllActive.mockResolvedValue([foreignItem]);

      await expect(
        service.getAllActiveOrderItems(user as User),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should return all active items for manager', async () => {
      const user = createUser(10, Role.MANAGER);
      const order1 = createOrder(1);
      const order2 = createOrder(2, Status.ACCEPTED, 2);
      const item1 = createOrderItem(1, order1);
      const item2 = createOrderItem(2, order2);

      repository.findAllActive.mockResolvedValue([item1, item2]);
      mapper.mapEntityListToDtoList.mockReturnValue([{ id: 1 }, { id: 2 }]);

      const result = await service.getAllActiveOrderItems(user as User);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith([
        item1,
        item2,
      ]);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should return all active items for admin', async () => {
      const user = createUser(100, Role.ADMIN);
      const order = createOrder(1, Status.CANCELLED_STAFF, 999);
      const item = createOrderItem(1, order);

      repository.findAllActive.mockResolvedValue([item]);
      mapper.mapEntityListToDtoList.mockReturnValue([{ id: 1 }]);

      await expect(
        service.getAllActiveOrderItems(user as User),
      ).resolves.toEqual([{ id: 1 }]);
    });
  });

  describe('getActiveOrderItemById', () => {
    it('should return order item for customer who owns the order', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const item = createOrderItem(1, createOrder(1, Status.NEW, 1));

      repository.findById.mockResolvedValue(item);
      mapper.mapEntityToDto.mockReturnValue({ id: 1 });

      await expect(
        service.getActiveOrderItemById(1, user as User),
      ).resolves.toEqual({ id: 1 });

      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(item);
    });

    it('should reject access for customer who does not own the order', async () => {
      const user = createUser(2, Role.CUSTOMER);
      const item = createOrderItem(1, createOrder(1, Status.NEW, 1));

      repository.findById.mockResolvedValue(item);

      await expect(
        service.getActiveOrderItemById(1, user as User),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });

    it('should return item for assigned courier', async () => {
      const user = createUser(7, Role.COURIER);
      const item = createOrderItem(1, createOrder(1, Status.DELIVERING, 1, 7));

      repository.findById.mockResolvedValue(item);
      mapper.mapEntityToDto.mockReturnValue({ id: 1 });

      await expect(
        service.getActiveOrderItemById(1, user as User),
      ).resolves.toEqual({ id: 1 });
    });

    it('should reject item access for a different courier', async () => {
      const user = createUser(8, Role.COURIER);
      const item = createOrderItem(1, createOrder(1, Status.DELIVERING, 1, 7));

      repository.findById.mockResolvedValue(item);

      await expect(
        service.getActiveOrderItemById(1, user as User),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getActiveEntityById', () => {
    it('should return active order item', async () => {
      const item = createOrderItem();

      repository.findById.mockResolvedValue(item);

      await expect(service.getActiveEntityById(1)).resolves.toBe(item);
    });

    it('should throw not found when order item does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getActiveEntityById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw not found when order item is inactive', async () => {
      const item = createOrderItem(
        1,
        createOrder(),
        createMenuItem(),
        1,
        false,
      );

      repository.findById.mockResolvedValue(item);

      await expect(service.getActiveEntityById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update quantity and recalculate order total', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const menuItem = createMenuItem(1, 10);
      const item = createOrderItem(10, order, menuItem, 2);
      const dto = { newQuantity: 5 };

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId
        .mockResolvedValueOnce([item])
        .mockResolvedValueOnce([createOrderItem(10, order, menuItem, 5)]);
      repository.save.mockResolvedValue(item);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);

      await service.update(10, dto, user as User);

      expect(item.quantity).toBe(5);
      expect(repository.save).toHaveBeenCalledWith(item);
      expect(ordersService.updateTotalPrice).toHaveBeenCalledWith(1, 50);
    });

    it('should reject update for inaccessible customer order', async () => {
      const user = createUser(2, Role.CUSTOMER);
      const item = createOrderItem(10, createOrder(1, Status.NEW, 1));

      repository.findById.mockResolvedValue(item);

      await expect(
        service.update(10, { newQuantity: 5 }, user as User),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject customer update when order is not NEW', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const item = createOrderItem(10, createOrder(1, Status.ACCEPTED, 1));

      repository.findById.mockResolvedValue(item);

      await expect(
        service.update(10, { newQuantity: 5 }, user as User),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject update for a closed order', async () => {
      const user = createUser(10, Role.MANAGER);
      const item = createOrderItem(10, createOrder(1, Status.COMPLETED, 1));

      repository.findById.mockResolvedValue(item);

      await expect(
        service.update(10, { newQuantity: 5 }, user as User),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject update when order total exceeds the limit', async () => {
      const user = createUser(10, Role.MANAGER);
      const order = createOrder(1, Status.ACCEPTED, 1);
      const currentItem = createOrderItem(10, order, createMenuItem(10, 10), 2);
      const otherItem = createOrderItem(11, order, createMenuItem(11, 10), 46);

      repository.findById.mockResolvedValue(currentItem);
      repository.findAllActiveByOrderId.mockResolvedValue([
        currentItem,
        otherItem,
      ]);

      await expect(
        service.update(10, { newQuantity: 5 }, user as User),
      ).rejects.toThrow(`Order id 1 total cannot exceed ${MAX_ORDER_TOTAL}`);

      expect(repository.save).not.toHaveBeenCalled();
      expect(currentItem.quantity).toBe(2);
    });

    it('should allow manager to update an order item', async () => {
      const user = createUser(10, Role.MANAGER);
      const order = createOrder(1, Status.ACCEPTED, 1);
      const menuItem = createMenuItem(1, 10);
      const item = createOrderItem(10, order, menuItem, 2);

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId
        .mockResolvedValueOnce([item])
        .mockResolvedValueOnce([createOrderItem(10, order, menuItem, 4)]);
      repository.save.mockResolvedValue(item);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);

      await expect(
        service.update(10, { newQuantity: 4 }, user as User),
      ).resolves.toBeUndefined();

      expect(repository.save).toHaveBeenCalledWith(item);
      expect(item.quantity).toBe(4);
    });

    it('should allow admin to update an order item', async () => {
      const user = createUser(100, Role.ADMIN);
      const order = createOrder(1, Status.ACCEPTED, 1);
      const menuItem = createMenuItem(1, 10);
      const item = createOrderItem(10, order, menuItem, 2);

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId
        .mockResolvedValueOnce([item])
        .mockResolvedValueOnce([createOrderItem(10, order, menuItem, 3)]);
      repository.save.mockResolvedValue(item);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);

      await service.update(10, { newQuantity: 3 }, user as User);

      expect(repository.save).toHaveBeenCalledWith(item);
      expect(item.quantity).toBe(3);
    });
  });

  describe('deleteById', () => {
    it('should mark order item inactive and recalculate total', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const menuItem = createMenuItem(1, 10);
      const item = createOrderItem(10, order, menuItem, 2);

      repository.findById.mockResolvedValue(item);
      repository.save.mockResolvedValue(item);
      repository.findAllActiveByOrderId.mockResolvedValue([]);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);

      await service.deleteById(10, user as User);

      expect(item.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(item);
      expect(ordersService.updateTotalPrice).toHaveBeenCalledWith(1, 0);
    });

    it('should reject delete for inaccessible customer order', async () => {
      const user = createUser(2, Role.CUSTOMER);
      const item = createOrderItem(10, createOrder(1, Status.NEW, 1));

      repository.findById.mockResolvedValue(item);

      await expect(service.deleteById(10, user as User)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject delete from closed order', async () => {
      const user = createUser(10, Role.MANAGER);
      const item = createOrderItem(10, createOrder(1, Status.COMPLETED, 1));

      repository.findById.mockResolvedValue(item);

      await expect(service.deleteById(10, user as User)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should allow manager to delete an order item', async () => {
      const user = createUser(10, Role.MANAGER);
      const order = createOrder(1, Status.ACCEPTED, 1);
      const item = createOrderItem(10, order, createMenuItem(), 2);

      repository.findById.mockResolvedValue(item);
      repository.save.mockResolvedValue(item);
      repository.findAllActiveByOrderId.mockResolvedValue([]);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);

      await service.deleteById(10, user as User);

      expect(item.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(item);
    });
  });

  describe('restoreById', () => {
    it('should restore inactive order item and recalculate total', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const menuItem = createMenuItem(1, 10);
      const item = createOrderItem(10, order, menuItem, 2, false);

      repository.findById.mockResolvedValue(item);
      repository.findAllActiveByOrderId
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([item]);
      repository.save.mockResolvedValue(item);
      ordersService.updateTotalPrice.mockResolvedValue(undefined);

      await service.restoreById(10, user as User);

      expect(item.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(item);
      expect(ordersService.updateTotalPrice).toHaveBeenCalledWith(1, 20);
    });

    it('should throw not found when order item does not exist', async () => {
      const user = createUser(1, Role.CUSTOMER);

      repository.findById.mockResolvedValue(null);

      await expect(
        service.restoreById(10, user as User),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should be idempotent when order item is already active', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const item = createOrderItem(
        10,
        createOrder(1, Status.NEW, 1),
        createMenuItem(),
        2,
        true,
      );

      repository.findById.mockResolvedValue(item);

      await service.restoreById(10, user as User);

      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.findAllActiveByOrderId).not.toHaveBeenCalled();
    });

    it('should reject restore for inaccessible customer order', async () => {
      const user = createUser(2, Role.CUSTOMER);
      const item = createOrderItem(
        10,
        createOrder(1, Status.NEW, 1),
        createMenuItem(),
        2,
        false,
      );

      repository.findById.mockResolvedValue(item);

      await expect(
        service.restoreById(10, user as User),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject restore from closed order', async () => {
      const user = createUser(10, Role.MANAGER);
      const item = createOrderItem(
        10,
        createOrder(1, Status.COMPLETED, 1),
        createMenuItem(),
        2,
        false,
      );

      repository.findById.mockResolvedValue(item);

      await expect(
        service.restoreById(10, user as User),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should reject restore when order already has maximum number of items', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const inactiveItem = createOrderItem(
        10,
        order,
        createMenuItem(10, 5),
        1,
        false,
      );
      const activeItems = Array.from(
        { length: MAX_ITEMS_PER_ORDER },
        (_, index) =>
          createOrderItem(
            index + 1,
            order,
            createMenuItem(index + 100, 5),
            1,
            true,
          ),
      );

      repository.findById.mockResolvedValue(inactiveItem);
      repository.findAllActiveByOrderId.mockResolvedValue(activeItems);

      await expect(service.restoreById(10, user as User)).rejects.toThrow(
        `Order id 1 cannot contain more than ${MAX_ITEMS_PER_ORDER} items`,
      );

      expect(repository.save).not.toHaveBeenCalled();
      expect(inactiveItem.active).toBe(false);
    });

    it('should reject restore when order total exceeds the limit', async () => {
      const user = createUser(1, Role.CUSTOMER);
      const order = createOrder(1, Status.NEW, 1);
      const inactiveItem = createOrderItem(
        10,
        order,
        createMenuItem(10, 10),
        5,
        false,
      );
      const activeItem = createOrderItem(
        11,
        order,
        createMenuItem(11, 10),
        46,
        true,
      );

      repository.findById.mockResolvedValue(inactiveItem);
      repository.findAllActiveByOrderId.mockResolvedValue([activeItem]);

      await expect(service.restoreById(10, user as User)).rejects.toThrow(
        `Order id 1 total cannot exceed ${MAX_ORDER_TOTAL}`,
      );

      expect(repository.save).not.toHaveBeenCalled();
      expect(inactiveItem.active).toBe(false);
    });
  });

  describe('role access', () => {
    it('should allow admin to access an order item', async () => {
      const user = createUser(100, Role.ADMIN);
      const item = createOrderItem(
        1,
        createOrder(1, Status.CANCELLED_STAFF, 999),
      );

      repository.findById.mockResolvedValue(item);
      mapper.mapEntityToDto.mockReturnValue({ id: 1 });

      await expect(
        service.getActiveOrderItemById(1, user as User),
      ).resolves.toEqual({ id: 1 });
    });

    it('should allow manager to access an order item', async () => {
      const user = createUser(10, Role.MANAGER);
      const item = createOrderItem(1, createOrder(1, Status.ACCEPTED, 999));

      repository.findById.mockResolvedValue(item);
      mapper.mapEntityToDto.mockReturnValue({ id: 1 });

      await expect(
        service.getActiveOrderItemById(1, user as User),
      ).resolves.toEqual({ id: 1 });
    });
  });
});
