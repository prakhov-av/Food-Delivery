import { MenuItemsMapper } from './menu-items.mapper';
import { MenuItem } from '../menu-item.entity';
import { MenuItemDto } from './menu-item.dto';
import { MenuItemSaveDto } from './menu-item.save-dto';

describe('MenuItemsMapper', (): void => {
  let mapper: MenuItemsMapper;

  beforeEach((): void => {
    mapper = new MenuItemsMapper();
  });

  describe('mapEntityToDto', (): void => {
    it('should return empty dto when entity is null', (): void => {
      const result: MenuItemDto = mapper.mapEntityToDto(
        null as unknown as MenuItem,
      );

      expect(result).toBeInstanceOf(MenuItemDto);
      expect(result).toEqual(new MenuItemDto());
    });

    it('should map entity to dto', (): void => {
      const entity: MenuItem = {
        id: 1,
        name: 'Pizza',
        description: 'Cheese pizza',
        price: 12.5,
      } as MenuItem;

      const result: MenuItemDto = mapper.mapEntityToDto(entity);

      expect(result).toBeInstanceOf(MenuItemDto);
      expect(result.id).toBe(entity.id);
      expect(result.name).toBe(entity.name);
      expect(result.description).toBe(entity.description);
      expect(result.price).toBe(entity.price);
    });
  });

  describe('mapDtoToEntity', (): void => {
    it('should map save dto to entity', (): void => {
      const saveDto: MenuItemSaveDto = {
        name: 'Burger',
        description: 'Beef burger',
        price: 10.5,
      };

      const result: MenuItem = mapper.mapDtoToEntity(saveDto);

      expect(result).toBeInstanceOf(MenuItem);
      expect(result.name).toBe(saveDto.name);
      expect(result.description).toBe(saveDto.description);
      expect(result.price).toBe(saveDto.price);
    });
  });

  describe('mapEntityListToDtoList', (): void => {
    it('should map entity list to dto list', (): void => {
      const entities: MenuItem[] = [
        {
          id: 1,
          name: 'Pizza',
          description: 'Cheese pizza',
          price: 12.5,
        } as MenuItem,
        {
          id: 2,
          name: 'Burger',
          description: 'Beef burger',
          price: 10.5,
        } as MenuItem,
      ];

      const result: MenuItemDto[] = mapper.mapEntityListToDtoList(entities);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(MenuItemDto);
      expect(result[1]).toBeInstanceOf(MenuItemDto);

      expect(result[0]).toEqual({
        id: 1,
        name: 'Pizza',
        description: 'Cheese pizza',
        price: 12.5,
      });

      expect(result[1]).toEqual({
        id: 2,
        name: 'Burger',
        description: 'Beef burger',
        price: 10.5,
      });
    });

    it('should return empty list for empty entity list', (): void => {
      const result: MenuItemDto[] = mapper.mapEntityListToDtoList([]);

      expect(result).toEqual([]);
    });
  });
});
