import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { MenuSaveDto } from './dto/menu.save-dto';
import { MenuDto } from './dto/menu.dto';
import { MenuUpdateDto } from './dto/menu.update-dto';
import { MenusService } from './menus.service';
import { MenusMapper } from './dto/menus.mapper';
import { MenusRepository } from './menus.repository';
import { Menu } from './menu.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { Restaurant } from '../restaurants/restaurant.entity';
describe('MenusService', (): void => {
  const SAVE_DTO: MenuSaveDto = { name: 'Main Menu', restaurantId: 1 };
  const UPDATE_DTO: MenuUpdateDto = { newName: 'Updated Menu' };
  const makeMenu = (overrides: Partial<Menu> = {}): Menu =>
    ({
      id: 1,
      name: 'Main Menu',
      active: true,
      restaurant: { id: 1, name: 'Restaurant1' } as Restaurant,
      menuItems: [],
      ...overrides,
    }) as Menu;
  let service: MenusService;
  let repository: jest.Mocked<MenusRepository>;
  let restaurantsService: jest.Mocked<RestaurantsService>;
  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        MenusMapper,
        {
          provide: MenusRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: RestaurantsService,
          useValue: { getActiveEntityById: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(MenusService);
    repository = module.get(MenusRepository);
    restaurantsService = module.get(RestaurantsService);
    restaurantsService.getActiveEntityById.mockResolvedValue({
      id: 1,
      name: 'Restaurant1',
    } as Restaurant);
    repository.findAllActive.mockResolvedValue([makeMenu()]);
    repository.findById.mockResolvedValue(makeMenu());
    repository.save.mockImplementation(
      async (entity: Menu): Promise<Menu> => entity,
    );
  });
  describe('create', (): void => {
    it('should create an active menu for the restaurant', async (): Promise<void> => {
      const result = await service.create(SAVE_DTO);
      expect(restaurantsService.getActiveEntityById).toHaveBeenCalledWith(1);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
          restaurant: expect.objectContaining({ id: 1 }),
        }),
      );
      expect(result.name).toBe(SAVE_DTO.name);
    });
    it('should propagate restaurant lookup errors and not save', async (): Promise<void> => {
      restaurantsService.getActiveEntityById.mockRejectedValue(
        new EntityNotFoundException(Restaurant.name, 1),
      );
      await expect(service.create(SAVE_DTO)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
  describe('getAllActiveMenus', (): void => {
    it('should return menu DTOs', async (): Promise<void> => {
      const result: MenuDto[] = await service.getAllActiveMenus();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('Main Menu');
    });
    it('should throw when there are no active menus', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);
      await expect(service.getAllActiveMenus()).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });
  describe('getActiveMenuById', (): void => {
    it('should return the menu DTO', async (): Promise<void> => {
      const result = await service.getActiveMenuById(1);
      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });
    it('should throw when menu does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getActiveMenuById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
    it('should throw when menu is inactive', async (): Promise<void> => {
      repository.findById.mockResolvedValue(makeMenu({ active: false }));
      await expect(service.getActiveMenuById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });
  describe('getActiveEntityById', (): void => {
    it('should return an active menu entity', async (): Promise<void> => {
      const result = await service.getActiveEntityById(1);
      expect(result.id).toBe(1);
      expect(result.active).toBe(true);
    });
    it('should throw when menu is missing', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getActiveEntityById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
    it('should throw when menu is inactive', async (): Promise<void> => {
      repository.findById.mockResolvedValue(makeMenu({ active: false }));
      await expect(service.getActiveEntityById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });
  describe('update', (): void => {
    it('should update menu name and save', async (): Promise<void> => {
      const entity = makeMenu();
      repository.findById.mockResolvedValue(entity);
      await service.update(1, UPDATE_DTO);
      expect(entity.name).toBe(UPDATE_DTO.newName);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });
    it('should throw when menu does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);
      await expect(service.update(99, UPDATE_DTO)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
    it('should throw when getActiveEntityById returns an empty value', async (): Promise<void> => {
      jest
        .spyOn(service, 'getActiveEntityById')
        .mockResolvedValue(undefined as unknown as Menu);
      await expect(service.update(1, UPDATE_DTO)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
  describe('deleteById', (): void => {
    it('should mark menu inactive and save', async (): Promise<void> => {
      const entity = makeMenu();
      repository.findById.mockResolvedValue(entity);
      await service.deleteById(1);
      expect(entity.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });
    it('should throw when menu does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);
      await expect(service.deleteById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
  describe('restoreById', (): void => {
    it('should restore an inactive menu', async (): Promise<void> => {
      const entity = makeMenu({ active: false });
      repository.findById.mockResolvedValue(entity);
      await service.restoreById(1);
      expect(entity.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });
    it('should do nothing when menu is already active', async (): Promise<void> => {
      const entity = makeMenu({ active: true });
      repository.findById.mockResolvedValue(entity);
      await service.restoreById(1);
      expect(repository.save).not.toHaveBeenCalled();
    });
    it('should throw when menu does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);
      await expect(service.restoreById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
