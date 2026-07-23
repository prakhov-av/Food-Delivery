import { Test, TestingModule } from '@nestjs/testing';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { RestaurantSaveDto } from './dto/restaurant.save-dto';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsMapper } from './dto/restaurants.mapper';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantDto } from './dto/restaurant.dto';
import { Restaurant } from './restaurant.entity';
import { RestaurantUpdateDto } from './dto/restaurant.update-dto';
import { Menu } from '../menus/menu.entity';

describe('RestaurantsService', (): void => {
  const VALID_SAVE_DTO: RestaurantSaveDto = {
    name: 'Restaurant1',
    address: 'Address1',
    phone: '1234567891',
    email: 'rest1@test.com',
  };

  const VALID_SAVE_DTO_WITH_EXISTING_PHONE: RestaurantSaveDto = {
    name: 'Restaurant3',
    address: 'Address3',
    phone: '1234567893',
    email: 'rest1@test.com',
  };

  const VALID_ENTITY_TO_MOCK_RETURN_1: Restaurant = {
    id: 1,
    name: 'Restaurant1',
    address: 'Address1',
    phone: '1234567891',
    email: 'rest1@test.com',
    menu: new Menu(),
    orders: [],
    active: true,
  };

  const VALID_ENTITY_TO_MOCK_RETURN_2: Restaurant = {
    id: 2,
    name: 'Restaurant2',
    address: 'Address2',
    phone: '1234567892',
    email: 'rest2@test.com',
    menu: new Menu(),
    orders: [],
    active: true,
  };

  const VALID_UPDATE_DTO: RestaurantUpdateDto = {
    newName: 'New Restaurant Name',
  };

  let service: RestaurantsService;
  let repository: jest.Mocked<RestaurantsRepository>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        RestaurantsMapper,
        {
          provide: RestaurantsRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
            isPhoneExists: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RestaurantsService);
    repository = module.get(RestaurantsRepository);

    repository.isPhoneExists.mockImplementation(
      async (phone: string): Promise<boolean> => {
        return phone === '1234567893';
      },
    );

    repository.findAllActive.mockResolvedValue([
      VALID_ENTITY_TO_MOCK_RETURN_1,
      VALID_ENTITY_TO_MOCK_RETURN_2,
    ]);

    repository.save.mockImplementation(
      async (entity: Restaurant): Promise<Restaurant> => {
        if (entity.phone === '1234567891') {
          return VALID_ENTITY_TO_MOCK_RETURN_1;
        }

        throw Error('Restaurant save error');
      },
    );

    repository.findById.mockImplementation(
      async (id: number): Promise<Restaurant | null> => {
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
    it('should create active restaurant and return dto', async (): Promise<void> => {
      const result: RestaurantDto = await service.create(VALID_SAVE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: true }),
      );

      expect(result).toBeDefined();
      expect(result.name).toEqual(VALID_SAVE_DTO.name);
      expect(result.address).toEqual(VALID_SAVE_DTO.address);
      expect(result.phone).toEqual(VALID_SAVE_DTO.phone);
      expect(result.email).toEqual(VALID_SAVE_DTO.email);
    });

    it('should throw error if phone already exists', async (): Promise<void> => {
      const resultPromise: Promise<RestaurantDto> = service.create(
        VALID_SAVE_DTO_WITH_EXISTING_PHONE,
      );

      await expect(resultPromise).rejects.toThrow('already exists');
      await expect(resultPromise).rejects.toBeInstanceOf(EntitySaveException);
    });
  });

  describe('getAllActiveRestaurants', (): void => {
    it('should return list of restaurant DTOs', async (): Promise<void> => {
      const result: RestaurantDto[] = await service.getAllActiveRestaurants();

      expect(result).toBeDefined();
      expect(result.length).toEqual(2);

      const dto1: RestaurantDto = result[0];
      expect(dto1).toBeDefined();
      expect(dto1.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(dto1.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.name);
      expect(dto1.address).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.address);
      expect(dto1.phone).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.phone);
      expect(dto1.email).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.email);

      const dto2: RestaurantDto = result[1];
      expect(dto2).toBeDefined();
      expect(dto2.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.id);
      expect(dto2.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.name);
      expect(dto2.address).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.address);
      expect(dto2.phone).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.phone);
      expect(dto2.email).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.email);
    });

    it('should throw error if list of restaurants is empty', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);
      const resultPromise: Promise<RestaurantDto[]> =
        service.getAllActiveRestaurants();

      await expect(resultPromise).rejects.toThrow('not a single');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update restaurant name', async (): Promise<void> => {
      const idToUpdate: number = 1;
      await service.update(idToUpdate, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: idToUpdate,
          name: VALID_UPDATE_DTO.newName,
        }),
      );
    });

    it('should throw exception when restaurant is not found', async (): Promise<void> => {
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
