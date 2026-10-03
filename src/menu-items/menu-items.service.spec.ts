import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { MenuItemSaveDto } from './dto/menu-item.save-dto';
import { MenuItemDto } from './dto/menu-item.dto';
import { MenuItemUpdateDto } from './dto/menu-item.update-dto';
import { MenuItemsService } from './menu-items.service';
import { MenuItemsMapper } from './dto/menu-items.mapper';
import { MenuItemsRepository } from './menu-items.repository';
import { MenuItem } from './menu-item.entity';
import { MenusService } from '../menus/menus.service';
import { Menu } from '../menus/menu.entity';

describe('MenuItemsService', (): void => {
  const SAVE_DTO: MenuItemSaveDto = {
    name: 'Pizza',
    description: 'Classic pizza',
    price: 100,
    menuId: 1,
  };

  const UPDATE_DTO: MenuItemUpdateDto = {
    newName: 'Updated Pizza',
    newDescription: 'Updated description',
    newPrice: 120,
  };

  const makeMenuItem = (overrides: Partial<MenuItem> = {}): MenuItem =>
    ({
      id: 1,
      menu: { id: 1 } as Menu,
      orderItems: [],
      name: 'Pizza',
      description: 'Classic pizza',
      price: 100,
      active: true,
      ...overrides,
    }) as MenuItem;

  let service: MenuItemsService;
  let repository: jest.Mocked<MenuItemsRepository>;
  let menusService: jest.Mocked<MenusService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuItemsService,
        MenuItemsMapper,
        {
          provide: MenuItemsRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: MenusService,
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MenuItemsService);
    repository = module.get(MenuItemsRepository);
    menusService = module.get(MenusService);

    menusService.getActiveEntityById.mockResolvedValue({ id: 1 } as Menu);
    repository.findAllActive.mockResolvedValue([makeMenuItem()]);
    repository.findById.mockResolvedValue(makeMenuItem());
    repository.save.mockImplementation(
      async (entity: MenuItem): Promise<MenuItem> => entity,
    );
  });

  describe('create', (): void => {
    it('should create an active menu item', async (): Promise<void> => {
      const result = await service.create(SAVE_DTO);

      expect(menusService.getActiveEntityById).toHaveBeenCalledWith(1);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
          menu: expect.objectContaining({ id: 1 }),
        }),
      );
      expect(result.name).toBe(SAVE_DTO.name);
    });

    it('should propagate menu lookup errors and not save', async (): Promise<void> => {
      menusService.getActiveEntityById.mockRejectedValue(
        new EntityNotFoundException(Menu.name, 1),
      );

      await expect(service.create(SAVE_DTO)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllActiveMenuItems', (): void => {
    it('should return menu item DTOs', async (): Promise<void> => {
      const result: MenuItemDto[] = await service.getAllActiveMenuItems();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('Pizza');
      expect(result[0].description).toBe('Classic pizza');
      expect(result[0].price).toBe(100);
    });

    it('should throw when there are no active items', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(service.getAllActiveMenuItems()).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('getActiveMenuItemById', (): void => {
    it('should return a menu item DTO', async (): Promise<void> => {
      const result = await service.getActiveMenuItemById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });

    it('should throw when item does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getActiveMenuItemById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw when item is inactive', async (): Promise<void> => {
      repository.findById.mockResolvedValue(makeMenuItem({ active: false }));

      await expect(service.getActiveMenuItemById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('getActiveEntityById', (): void => {
    it('should return an active menu item entity', async (): Promise<void> => {
      const result = await service.getActiveEntityById(1);

      expect(result.active).toBe(true);
      expect(result.id).toBe(1);
    });

    it('should throw when item is missing', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getActiveEntityById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });

    it('should throw when item is inactive', async (): Promise<void> => {
      repository.findById.mockResolvedValue(makeMenuItem({ active: false }));

      await expect(service.getActiveEntityById(1)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update all editable fields and save', async (): Promise<void> => {
      const entity = makeMenuItem();
      repository.findById.mockResolvedValue(entity);

      await service.update(1, UPDATE_DTO);

      expect(entity.name).toBe(UPDATE_DTO.newName);
      expect(entity.description).toBe(UPDATE_DTO.newDescription);
      expect(entity.price).toBe(UPDATE_DTO.newPrice);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });

    it('should throw when item does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(99, UPDATE_DTO)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteById', (): void => {
    it('should mark item inactive and save', async (): Promise<void> => {
      const entity = makeMenuItem();
      repository.findById.mockResolvedValue(entity);

      await service.deleteById(1);

      expect(entity.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });

    it('should throw when item does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deleteById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', (): void => {
    it('should restore an inactive item', async (): Promise<void> => {
      const entity = makeMenuItem({ active: false });
      repository.findById.mockResolvedValue(entity);

      await service.restoreById(1);

      expect(entity.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });

    it('should do nothing when item is already active', async (): Promise<void> => {
      const entity = makeMenuItem({ active: true });
      repository.findById.mockResolvedValue(entity);

      await service.restoreById(1);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when item does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(service.restoreById(99)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
