import { Menu } from '../menu.entity';
import { MenuDto } from './menu.dto';
import { MenuSaveDto } from './menu.save-dto';
import { MenusMapper } from './menus.mapper';
describe('MenusMapper', (): void => {
  let mapper: MenusMapper;
  beforeEach((): void => {
    mapper = new MenusMapper();
  });
  describe('mapEntityToDto', (): void => {
    it('should map entity to DTO', (): void => {
      const entity = { id: 1, name: 'Main Menu' } as Menu;
      const result: MenuDto = mapper.mapEntityToDto(entity);
      expect(result).toBeInstanceOf(MenuDto);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Main Menu');
    });
    it('should return empty DTO when entity is empty', (): void => {
      const result: MenuDto = mapper.mapEntityToDto(
        undefined as unknown as Menu,
      );
      expect(result).toBeInstanceOf(MenuDto);
      expect(result).toEqual(new MenuDto());
    });
  });
  describe('mapDtoToEntity', (): void => {
    it('should map save DTO to entity', (): void => {
      const saveDto: MenuSaveDto = { name: 'Main Menu', restaurantId: 1 };
      const result: Menu = mapper.mapDtoToEntity(saveDto);
      expect(result).toBeInstanceOf(Menu);
      expect(result.name).toBe('Main Menu');
    });
  });
  describe('mapEntityListToDtoList', (): void => {
    it('should map entity list to DTO list', (): void => {
      const entities = [
        { id: 1, name: 'Main Menu' },
        { id: 2, name: 'Second Menu' },
      ] as Menu[];
      const result: MenuDto[] = mapper.mapEntityListToDtoList(entities);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(MenuDto);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('Main Menu');
      expect(result[1].id).toBe(2);
      expect(result[1].name).toBe('Second Menu');
    });
    it('should return an empty list for an empty entity list', (): void => {
      const result: MenuDto[] = mapper.mapEntityListToDtoList([]);
      expect(result).toEqual([]);
    });
  });
});
