import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { Menu } from '../menus/menu.entity';
import { MenuItemsService } from './menu-items.service';
import { MenuItemDto } from './dto/menu-item.dto';
import { MenuItem } from './menu-item.entity';
import { MenuItemSaveDto } from './dto/menu-item.save-dto';
import { MenuItemUpdateDto } from './dto/menu-item.update-dto';
import { MenuItemsRepository } from './menu-items.repository';
import { MenuItemsMapper } from './dto/menu-items.mapper';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { MenusService } from '../menus/menus.service';

describe('MenuItemsService', (): void => {
  const VALID_SAVE_DTO: MenuItemSaveDto = {
    name: 'MenuItem1',
    description: 'Description1',
    price: 100,
    menuId: 1,
  };

  const VALID_SAVE_DTO_WITH_EXISTING_NAME: MenuItemSaveDto = {
    name: 'MenuItem1',
    description: 'Description1',
    price: 100,
    menuId: 1,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_1: MenuItem = {
    id: 1,
    menu: {} as Menu,
    orderItems: [],
    name: 'MenuItem1',
    description: 'Description1',
    price: 100,
    active: true,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_2: MenuItem = {
    id: 2,
    menu: {} as Menu,
    orderItems: [],
    name: 'MenuItem2',
    description: 'Description2',
    price: 200,
    active: true,
  };

  const VALID_UPDATE_DTO: MenuItemUpdateDto = {
    newName: 'New Menu item Name',
    newDescription: 'New Menu item description',
    newPrice: 300,
  };

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

    repository.findAllActive.mockResolvedValue([
      VALID_ENTITY_TO_MOCK_RETURN_1,
      VALID_ENTITY_TO_MOCK_RETURN_2,
    ]);

    repository.save.mockImplementation(
      async (entity: MenuItem): Promise<MenuItem> => {
        if (entity.active) {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        throw Error('Menu item save error');
      },
    );

    repository.findById.mockImplementation(
      async (id: number): Promise<MenuItem | null> => {
        if (id === 1) {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        if (id === 2) {
          return VALID_ENTITY_TO_MOCK_RETURN_2;
        }

        return null;
      },
    );

    menusService.getActiveEntityById.mockResolvedValue({
      id: 1,
    } as Menu);
  });

  describe('create', (): void => {
    it('should create active menu item and return dto', async (): Promise<void> => {
      const result: MenuItemDto = await service.create(VALID_SAVE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: true }),
      );

      expect(result).toBeDefined();
      expect(result.name).toEqual(VALID_SAVE_DTO.name);
    });
  });

  describe('getAllActiveMenus', (): void => {
    it('should return list of menu item DTOs', async (): Promise<void> => {
      const result: MenuItemDto[] = await service.getAllActiveMenuItems();

      expect(result).toBeDefined();
      expect(result.length).toEqual(2);

      const dto1: MenuItemDto = result[0];
      expect(dto1).toBeDefined();
      expect(dto1.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(dto1.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.name);
      expect(dto1.description).toEqual(
        VALID_ENTITY_TO_MOCK_RETURN_1.description,
      );
      expect(dto1.price).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.price);

      const dto2: MenuItemDto = result[1];
      expect(dto2).toBeDefined();
      expect(dto2.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.id);
      expect(dto2.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.name);
      expect(dto2.description).toEqual(
        VALID_ENTITY_TO_MOCK_RETURN_2.description,
      );
      expect(dto2.price).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.price);
    });

    it('should throw error if list of menu items is empty', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);
      const resultPromise: Promise<MenuItemDto[]> =
        service.getAllActiveMenuItems();

      await expect(resultPromise).rejects.toThrow('not a single');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update menu item name', async (): Promise<void> => {
      const idToUpdate: number = 1;
      await service.update(idToUpdate, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: idToUpdate,
          name: VALID_UPDATE_DTO.newName,
        }),
      );
    });

    it('should throw exception when menu item is not found', async (): Promise<void> => {
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
