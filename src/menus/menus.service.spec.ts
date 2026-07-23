import { Test, TestingModule } from '@nestjs/testing';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { Restaurant } from '../restaurants/restaurant.entity';
import { Menu } from './menu.entity';
import { MenuSaveDto } from './dto/menu.save-dto';
import { MenuUpdateDto } from './dto/menu.update-dto';
import { MenusService } from './menus.service';
import { MenusRepository } from './menus.repository';
import { MenusMapper } from './dto/menus.mapper';
import { MenuDto } from './dto/menu.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';

describe('MenusService', (): void => {
  const VALID_SAVE_DTO: MenuSaveDto = {
    name: 'Menu1',
    restaurantId: 1,
  };

  const VALID_SAVE_DTO_WITH_EXISTING_NAME: MenuSaveDto = {
    name: 'Menu1',
    restaurantId: 1,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_1: Menu = {
    id: 1,
    name: 'Menu1',
    restaurant: {} as Restaurant,
    items: [],
    active: true,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_2: Menu = {
    id: 2,
    name: 'Menu2',
    restaurant: {} as Restaurant,
    items: [],
    active: true,
  };

  const VALID_UPDATE_DTO: MenuUpdateDto = {
    newName: 'New Menu Name',
  };

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
          useValue: {
            getActiveEntityById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MenusService);
    repository = module.get(MenusRepository);
    restaurantsService = module.get(RestaurantsService);

    repository.findAllActive.mockResolvedValue([
      VALID_ENTITY_TO_MOCK_RETURN_1,
      VALID_ENTITY_TO_MOCK_RETURN_2,
    ]);

    repository.save.mockImplementation(async (entity: Menu): Promise<Menu> => {
      if (entity.active) {
        return VALID_ENTITY_TO_MOCK_RETURN_1;
      }

      throw Error('Menu save error');
    });

    repository.findById.mockImplementation(
      async (id: number): Promise<Menu | null> => {
        if (id === 1) {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        if (id === 2) {
          return VALID_ENTITY_TO_MOCK_RETURN_2;
        }

        return null;
      },
    );

    restaurantsService.getActiveEntityById.mockResolvedValue({
      id: 1,
    } as Restaurant);
  });

  describe('create', (): void => {
    it('should create active menu and return dto', async (): Promise<void> => {
      const result: MenuDto = await service.create(VALID_SAVE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: true }),
      );

      expect(result).toBeDefined();
      expect(result.name).toEqual(VALID_SAVE_DTO.name);
    });

    // it('should throw error if name already exists', async (): Promise<void> => {
    //   const resultPromise: Promise<MenuDto> = service.create(
    //     VALID_SAVE_DTO_WITH_EXISTING_NAME,
    //   );
    //
    //   await expect(resultPromise).rejects.toThrow('already exists');
    //   await expect(resultPromise).rejects.toBeInstanceOf(EntitySaveException);
    // });
  });

  describe('getAllActiveMenus', (): void => {
    it('should return list of menu DTOs', async (): Promise<void> => {
      const result: MenuDto[] = await service.getAllActiveMenus();

      expect(result).toBeDefined();
      expect(result.length).toEqual(2);

      const dto1: MenuDto = result[0];
      expect(dto1).toBeDefined();
      expect(dto1.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(dto1.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.name);

      const dto2: MenuDto = result[1];
      expect(dto2).toBeDefined();
      expect(dto2.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.id);
      expect(dto2.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.name);
    });

    it('should throw error if list of menus is empty', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);
      const resultPromise: Promise<MenuDto[]> = service.getAllActiveMenus();

      await expect(resultPromise).rejects.toThrow('not a single');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update menu name', async (): Promise<void> => {
      const idToUpdate: number = 1;
      await service.update(idToUpdate, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: idToUpdate,
          name: VALID_UPDATE_DTO.newName,
        }),
      );
    });

    it('should throw exception when menu is not found', async (): Promise<void> => {
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
