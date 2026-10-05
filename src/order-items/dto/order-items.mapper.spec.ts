import { MenuItem } from '../../menu-items/menu-item.entity';
import { MenuItemsMapper } from '../../menu-items/dto/menu-items.mapper';
import { OrderItem } from '../order-item.entity';
import { OrderItemDto } from './order-item.dto';
import { OrderItemSaveDto } from './order-item.save-dto';
import { OrderItemsMapper } from './order-items.mapper';

describe('OrderItemsMapper', (): void => {
  let mapper: OrderItemsMapper;

  beforeEach((): void => {
    mapper = new OrderItemsMapper(new MenuItemsMapper());
  });

  describe('mapEntityToDto', (): void => {
    it('should map entity to DTO', (): void => {
      const menuItem: MenuItem = {
        id: 1,
      } as MenuItem;

      const entity: OrderItem = {
        id: 1,
        menuItem,
        quantity: 2,
      } as OrderItem;

      const result: OrderItemDto = mapper.mapEntityToDto(entity);

      expect(result).toBeInstanceOf(OrderItemDto);
      expect(result.id).toBe(1);
      expect(result.quantity).toBe(2);
      expect(result.menuItem).toBeDefined();
      expect(result.menuItem.id).toBe(1);
    });

    it('should return empty DTO when entity is empty', (): void => {
      const result: OrderItemDto = mapper.mapEntityToDto(
        undefined as unknown as OrderItem,
      );

      expect(result).toBeInstanceOf(OrderItemDto);
      expect(result).toEqual(new OrderItemDto());
    });
  });

  describe('mapDtoToEntity', (): void => {
    it('should map save DTO to entity', (): void => {
      const saveDto: OrderItemSaveDto = {
        orderId: 1,
        menuItemId: 1,
        quantity: 3,
      };

      const result: OrderItem = mapper.mapDtoToEntity(saveDto);

      expect(result).toBeInstanceOf(OrderItem);
      expect(result.quantity).toBe(3);
    });
  });

  describe('mapEntityListToDtoList', (): void => {
    it('should map entity list to DTO list', (): void => {
      const entities: OrderItem[] = [
        {
          id: 1,
          menuItem: { id: 1 } as MenuItem,
          quantity: 2,
        } as OrderItem,
        {
          id: 2,
          menuItem: { id: 2 } as MenuItem,
          quantity: 4,
        } as OrderItem,
      ];

      const result: OrderItemDto[] = mapper.mapEntityListToDtoList(entities);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(OrderItemDto);
      expect(result[0].id).toBe(1);
      expect(result[0].quantity).toBe(2);
      expect(result[0].menuItem.id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[1].quantity).toBe(4);
      expect(result[1].menuItem.id).toBe(2);
    });

    it('should return an empty list for an empty entity list', (): void => {
      const result: OrderItemDto[] = mapper.mapEntityListToDtoList([]);

      expect(result).toEqual([]);
    });
  });
});
