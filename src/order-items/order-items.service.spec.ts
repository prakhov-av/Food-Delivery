import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { MenuItemsService } from '../menu-items/menu-items.service';
import { MenuItem } from '../menu-items/menu-item.entity';
import { MenuItemsMapper } from '../menu-items/dto/menu-items.mapper';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItem } from './order-item.entity';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';
import { OrderItemsService } from './order-items.service';
import { OrderItemsRepository } from './order-items.repository';
import { OrdersService } from '../orders/orders.service';
import { OrderItemsMapper } from './dto/order-items.mapper';
import { OrderItemDto } from './dto/order-item.dto';
import { Order } from '../orders/order.entity';

describe('OrderItemsService', (): void => {
  const VALID_SAVE_DTO: OrderItemSaveDto = {
    orderId: 1,
    menuItemId: 1,
    quantity: 1,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_1: OrderItem = {
    id: 1,
    order: { id: 1 } as Order,
    menuItem: { id: 1 } as MenuItem,
    quantity: 1,
    active: true,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_2: OrderItem = {
    id: 2,
    order: { id: 1 } as Order,
    menuItem: { id: 2 } as MenuItem,
    quantity: 1,
    active: true,
  };

  const VALID_UPDATE_DTO: OrderItemUpdateDto = {
    newQuantity: 2,
  };

  let service: OrderItemsService;
  let repository: jest.Mocked<OrderItemsRepository>;
  let ordersService: jest.Mocked<OrdersService>;
  let menuItemsService: jest.Mocked<MenuItemsService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderItemsService,
        OrderItemsMapper,
        {
          provide: OrderItemsRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
        {
          provide: MenuItemsService,
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
        {
          provide: MenuItemsMapper,
          useValue: {
            mapEntityToDto: jest.fn((entity: MenuItem) => ({
              id: entity.id,
            })),
          },
        },
      ],
    }).compile();

    service = module.get(OrderItemsService);
    repository = module.get(OrderItemsRepository);
    ordersService = module.get(OrdersService);
    menuItemsService = module.get(MenuItemsService);
    ordersService.getActiveEntityById.mockResolvedValue({ id: 1 } as Order);
    menuItemsService.getActiveEntityById.mockResolvedValue({
      id: 1,
    } as MenuItem);

    repository.findAllActive.mockResolvedValue([
      VALID_ENTITY_TO_MOCK_RETURN_1,
      VALID_ENTITY_TO_MOCK_RETURN_2,
    ]);

    repository.save.mockImplementation(
      async (entity: OrderItem): Promise<OrderItem> => {
        if (entity.active) {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        throw Error('Order item save error');
      },
    );

    repository.findById.mockImplementation(
      async (id: number): Promise<OrderItem | null> => {
        if (id === 1) {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        if (id === 2) {
          return VALID_ENTITY_TO_MOCK_RETURN_2;
        }

        return null;
      },
    );
  });

  describe('create', (): void => {
    it('should create active order item and return dto', async (): Promise<void> => {
      const result: OrderItemDto = await service.create(VALID_SAVE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: true }),
      );

      expect(result).toBeDefined();
      expect(result.menuItem.id).toEqual(VALID_SAVE_DTO.menuItemId);
    });
  });

  describe('getAllActiveOrderItems', (): void => {
    it('should return list of order item DTOs', async (): Promise<void> => {
      const result: OrderItemDto[] = await service.getAllActiveOrderItems();

      expect(result).toBeDefined();
      expect(result.length).toEqual(2);

      const dto1: OrderItemDto = result[0];
      expect(dto1).toBeDefined();
      expect(dto1.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(dto1.menuItem.id).toEqual(
        VALID_ENTITY_TO_MOCK_RETURN_1.menuItem.id,
      );
      expect(dto1.quantity).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.quantity);

      const dto2: OrderItemDto = result[1];
      expect(dto2).toBeDefined();
      expect(dto2.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.id);
      expect(dto2.menuItem.id).toEqual(
        VALID_ENTITY_TO_MOCK_RETURN_2.menuItem.id,
      );
      expect(dto2.quantity).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.quantity);
    });

    it('should throw error if list of order items is empty', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);
      const resultPromise: Promise<OrderItemDto[]> =
        service.getAllActiveOrderItems();

      await expect(resultPromise).rejects.toThrow('not a single');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update order item quantity', async (): Promise<void> => {
      const idToUpdate: number = 1;
      await service.update(idToUpdate, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: idToUpdate,
          quantity: VALID_UPDATE_DTO.newQuantity,
        }),
      );
    });

    it('should throw exception when order item is not found', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.update(
        1000,
        VALID_UPDATE_DTO,
      );

      await expect(resultPromise).rejects.toThrow('not found');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });
});
