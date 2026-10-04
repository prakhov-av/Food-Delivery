import { RestaurantsRepository } from './restaurants.repository';
import { Restaurant } from './restaurant.entity';

describe('RestaurantsRepository', (): void => {
  let repository: RestaurantsRepository;

  const typeOrmRepository = {
    save: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
    existsBy: jest.fn(),
  };

  beforeEach((): void => {
    jest.clearAllMocks();

    repository = new RestaurantsRepository(typeOrmRepository as never);
  });

  describe('save', (): void => {
    it('should save and return restaurant', async (): Promise<void> => {
      const restaurant: Restaurant = {
        id: 1,
        name: 'Restaurant 1',
        address: 'Address 1',
        phone: '123456789',
        email: 'restaurant@test.com',
        active: true,
      } as Restaurant;

      typeOrmRepository.save.mockResolvedValue(restaurant);

      const result: Restaurant = await repository.save(restaurant);

      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(restaurant);
      expect(result).toBe(restaurant);
    });

    it('should propagate save error', async (): Promise<void> => {
      const restaurant = { id: 1 } as Restaurant;

      typeOrmRepository.save.mockRejectedValue(
        new Error('Database save error'),
      );

      await expect(repository.save(restaurant)).rejects.toThrow(
        'Database save error',
      );

      expect(typeOrmRepository.save).toHaveBeenCalledWith(restaurant);
    });
  });

  describe('findAllActive', (): void => {
    it('should return active restaurants', async (): Promise<void> => {
      const restaurants: Restaurant[] = [
        {
          id: 1,
          name: 'Restaurant 1',
          active: true,
        } as Restaurant,
        {
          id: 2,
          name: 'Restaurant 2',
          active: true,
        } as Restaurant,
      ];

      typeOrmRepository.findBy.mockResolvedValue(restaurants);

      const result: Restaurant[] = await repository.findAllActive();

      expect(typeOrmRepository.findBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
      expect(result).toBe(restaurants);
    });

    it('should return empty array when there are no active restaurants', async (): Promise<void> => {
      typeOrmRepository.findBy.mockResolvedValue([]);

      const result: Restaurant[] = await repository.findAllActive();

      expect(result).toEqual([]);

      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findAllActive()).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('findById', (): void => {
    it('should return restaurant by id', async (): Promise<void> => {
      const restaurant: Restaurant = {
        id: 10,
        name: 'Restaurant 10',
        active: true,
      } as Restaurant;

      typeOrmRepository.findOneBy.mockResolvedValue(restaurant);

      const result: Restaurant | null = await repository.findById(10);

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
      });
      expect(result).toBe(restaurant);
    });

    it('should return null when restaurant does not exist', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(null);

      const result: Restaurant | null = await repository.findById(999);

      expect(result).toBeNull();

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findById(1)).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('deleteById', (): void => {
    it('should delete restaurant by id', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
      });

      await repository.deleteById(15);

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(15);
    });

    it('should complete when restaurant does not exist', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 0,
      });

      await expect(repository.deleteById(999)).resolves.toBeUndefined();

      expect(typeOrmRepository.delete).toHaveBeenCalledWith(999);
    });

    it('should propagate delete error', async (): Promise<void> => {
      typeOrmRepository.delete.mockRejectedValue(
        new Error('Database delete error'),
      );

      await expect(repository.deleteById(1)).rejects.toThrow(
        'Database delete error',
      );
    });
  });

  describe('isPhoneExists', (): void => {
    it('should return true when phone exists', async (): Promise<void> => {
      typeOrmRepository.existsBy.mockResolvedValue(true);

      const result: boolean = await repository.isPhoneExists('123456789');

      expect(typeOrmRepository.existsBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.existsBy).toHaveBeenCalledWith({
        phone: '123456789',
      });
      expect(result).toBe(true);
    });

    it('should return false when phone does not exist', async (): Promise<void> => {
      typeOrmRepository.existsBy.mockResolvedValue(false);

      const result: boolean = await repository.isPhoneExists('987654321');

      expect(typeOrmRepository.existsBy).toHaveBeenCalledWith({
        phone: '987654321',
      });
      expect(result).toBe(false);
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.existsBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.isPhoneExists('123456789')).rejects.toThrow(
        'Database query error',
      );
    });
  });
});
