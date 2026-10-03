import { Test, TestingModule } from '@nestjs/testing';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsMapper } from './dto/restaurants.mapper';
import { Restaurant } from './restaurant.entity';
import { RestaurantDto } from './dto/restaurant.dto';
import { RestaurantSaveDto } from './dto/restaurant.save-dto';
import { RestaurantUpdateDto } from './dto/restaurant.update-dto';

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let repository: {
    save: jest.Mock;
    findAllActive: jest.Mock;
    findById: jest.Mock;
    isPhoneExists: jest.Mock;
  };
  let mapper: {
    mapDtoToEntity: jest.Mock;
    mapEntityToDto: jest.Mock;
    mapEntityListToDtoList: jest.Mock;
  };

  const SAVE_DTO: RestaurantSaveDto = {
    name: 'Restaurant1',
    address: 'Address1',
    phone: '1234567890',
    email: 'rest1@test.com',
  };

  const UPDATE_DTO: RestaurantUpdateDto = {
    newName: 'New Restaurant Name',
  };

  const RESTAURANT_ENTITY = {
    id: 1,
    name: 'Restaurant1',
    address: 'Address1',
    phone: '1234567890',
    email: 'rest1@test.com',
    active: true,
    menus: [],
  } as Restaurant;

  const RESTAURANT_DTO = {
    id: 1,
    name: 'Restaurant1',
    address: 'Address1',
    phone: '1234567890',
    email: 'rest1@test.com',
  } as RestaurantDto;

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
      findAllActive: jest.fn(),
      findById: jest.fn(),
      isPhoneExists: jest.fn(),
    };

    mapper = {
      mapDtoToEntity: jest.fn(),
      mapEntityToDto: jest.fn(),
      mapEntityListToDtoList: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        { provide: RestaurantsRepository, useValue: repository },
        { provide: RestaurantsMapper, useValue: mapper },
      ],
    }).compile();

    service = module.get<RestaurantsService>(RestaurantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an active restaurant and return DTO', async () => {
      repository.isPhoneExists.mockResolvedValue(false);

      const entity = { ...RESTAURANT_ENTITY, active: true };

      mapper.mapDtoToEntity.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);
      mapper.mapEntityToDto.mockReturnValue(RESTAURANT_DTO);

      const result: RestaurantDto = await service.create(SAVE_DTO);

      expect(repository.isPhoneExists).toHaveBeenCalledWith(SAVE_DTO.phone);
      expect(mapper.mapDtoToEntity).toHaveBeenCalledWith(SAVE_DTO);
      expect(entity.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(entity);
      expect(result).toEqual(RESTAURANT_DTO);
    });

    it('should throw EntitySaveException when phone already exists', async () => {
      repository.isPhoneExists.mockResolvedValue(true);

      await expect(service.create(SAVE_DTO)).rejects.toThrow(
        EntitySaveException,
      );

      expect(repository.isPhoneExists).toHaveBeenCalledWith(SAVE_DTO.phone);
      expect(mapper.mapDtoToEntity).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });

    it('should propagate repository save error', async () => {
      repository.isPhoneExists.mockResolvedValue(false);

      const entity = { ...RESTAURANT_ENTITY, active: true };

      mapper.mapDtoToEntity.mockReturnValue(entity);

      const error = new Error('save error');
      repository.save.mockRejectedValue(error);

      await expect(service.create(SAVE_DTO)).rejects.toThrow(error);

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });
  });

  describe('getAllActiveRestaurants', () => {
    it('should return all active restaurants', async () => {
      const restaurants = [
        RESTAURANT_ENTITY,
        { ...RESTAURANT_ENTITY, id: 2, name: 'Restaurant2' },
      ];

      const dtoList = [
        RESTAURANT_DTO,
        { ...RESTAURANT_DTO, id: 2, name: 'Restaurant2' },
      ];

      repository.findAllActive.mockResolvedValue(restaurants);
      mapper.mapEntityListToDtoList.mockReturnValue(dtoList);

      const result = await service.getAllActiveRestaurants();

      expect(repository.findAllActive).toHaveBeenCalled();
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith(restaurants);
      expect(result).toEqual(dtoList);
    });

    it('should throw EntityNotFoundException when there are no active restaurants', async () => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(service.getAllActiveRestaurants()).rejects.toThrow(
        EntityNotFoundException,
      );

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });
  });

  describe('getActiveRestaurantById', () => {
    it('should return restaurant DTO', async () => {
      repository.findById.mockResolvedValue(RESTAURANT_ENTITY);
      mapper.mapEntityToDto.mockReturnValue(RESTAURANT_DTO);

      const result = await service.getActiveRestaurantById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(RESTAURANT_ENTITY);
      expect(result).toEqual(RESTAURANT_DTO);
    });

    it('should throw when restaurant does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getActiveRestaurantById(1)).rejects.toThrow(
        EntityNotFoundException,
      );

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });

    it('should throw when restaurant is inactive', async () => {
      repository.findById.mockResolvedValue({
        ...RESTAURANT_ENTITY,
        active: false,
      });

      await expect(service.getActiveRestaurantById(1)).rejects.toThrow(
        EntityNotFoundException,
      );

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });
  });

  describe('getActiveEntityById', () => {
    it('should return active restaurant entity', async () => {
      repository.findById.mockResolvedValue(RESTAURANT_ENTITY);

      const result = await service.getActiveEntityById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(RESTAURANT_ENTITY);
    });

    it('should throw when restaurant does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getActiveEntityById(1)).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw when restaurant is inactive', async () => {
      repository.findById.mockResolvedValue({
        ...RESTAURANT_ENTITY,
        active: false,
      });

      await expect(service.getActiveEntityById(1)).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update restaurant name and save', async () => {
      const entity = { ...RESTAURANT_ENTITY, active: true };

      repository.findById.mockResolvedValue(entity);
      repository.save.mockResolvedValue(entity);

      await service.update(1, UPDATE_DTO);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(entity.name).toBe(UPDATE_DTO.newName);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });

    it('should throw when restaurant does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(1, UPDATE_DTO)).rejects.toThrow(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when getActiveEntityById returns an empty value', async () => {
      jest
        .spyOn(service, 'getActiveEntityById')
        .mockResolvedValue(undefined as unknown as Restaurant);

      await expect(service.update(1, UPDATE_DTO)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should propagate repository save error', async () => {
      const entity = { ...RESTAURANT_ENTITY, active: true };

      repository.findById.mockResolvedValue(entity);

      const error = new Error('save error');
      repository.save.mockRejectedValue(error);

      await expect(service.update(1, UPDATE_DTO)).rejects.toThrow(error);
    });
  });

  describe('deleteById', () => {
    it('should deactivate restaurant and save', async () => {
      const entity = { ...RESTAURANT_ENTITY, active: true };

      repository.findById.mockResolvedValue(entity);
      repository.save.mockResolvedValue(entity);

      await service.deleteById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(entity.active).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });

    it('should throw when restaurant does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deleteById(1)).rejects.toThrow(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', () => {
    it('should restore inactive restaurant', async () => {
      const entity = { ...RESTAURANT_ENTITY, active: false };

      repository.findById.mockResolvedValue(entity);
      repository.save.mockResolvedValue(entity);

      await service.restoreById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(entity.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });

    it('should do nothing when restaurant is already active', async () => {
      const entity = { ...RESTAURANT_ENTITY, active: true };

      repository.findById.mockResolvedValue(entity);

      await service.restoreById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(repository.save).not.toHaveBeenCalled();
      expect(entity.active).toBe(true);
    });

    it('should throw when restaurant does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.restoreById(1)).rejects.toThrow(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
