import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from './order.entity';
import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', (): void => {
  let repository: OrdersRepository;
  let typeOrmRepository: jest.Mocked<Repository<Order>>;

  const ORDER: Order = {
    id: 1,
    active: true,
  } as Order;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersRepository,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            save: jest.fn(),
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<OrdersRepository>(OrdersRepository);

    typeOrmRepository = module.get<jest.Mocked<Repository<Order>>>(
      getRepositoryToken(Order),
    );
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('save', (): void => {
    it('should save and return the order', async (): Promise<void> => {
      typeOrmRepository.save.mockResolvedValue(ORDER);

      const result: Order = await repository.save(ORDER);

      expect(result).toBe(ORDER);
      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(ORDER);
    });

    it('should propagate repository save error', async (): Promise<void> => {
      const error: Error = new Error('Save error');

      typeOrmRepository.save.mockRejectedValue(error);

      await expect(repository.save(ORDER)).rejects.toThrow('Save error');

      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(ORDER);
    });
  });

  describe('findById', (): void => {
    it('should return the order by id', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(ORDER);

      const result: Order | null = await repository.findById(1);

      expect(result).toBe(ORDER);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
      });
    });

    it('should return null when the order does not exist', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(null);

      const result: Order | null = await repository.findById(999);

      expect(result).toBeNull();
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });

    it('should propagate repository findOneBy error', async (): Promise<void> => {
      const error: Error = new Error('Find by id error');

      typeOrmRepository.findOneBy.mockRejectedValue(error);

      await expect(repository.findById(1)).rejects.toThrow('Find by id error');

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
      });
    });
  });

  describe('findByIdWithRelations', (): void => {
    it('should return the order with required relations', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(ORDER);

      const result: Order | null = await repository.findByIdWithRelations(1);

      expect(result).toBe(ORDER);
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });

    it('should return null when the order does not exist', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(null);

      const result: Order | null = await repository.findByIdWithRelations(999);

      expect(result).toBeNull();
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });

    it('should propagate repository findOne error', async (): Promise<void> => {
      const error: Error = new Error('Find with relations error');

      typeOrmRepository.findOne.mockRejectedValue(error);

      await expect(repository.findByIdWithRelations(1)).rejects.toThrow(
        'Find with relations error',
      );

      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });
  });

  describe('findAllActive', (): void => {
    it('should return all active orders with required relations', async (): Promise<void> => {
      const orders: Order[] = [
        ORDER,
        {
          ...ORDER,
          id: 2,
        },
      ];

      typeOrmRepository.find.mockResolvedValue(orders);

      const result: Order[] = await repository.findAllActive();

      expect(result).toBe(orders);
      expect(typeOrmRepository.find).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.find).toHaveBeenCalledWith({
        where: {
          active: true,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });

    it('should return an empty array when there are no active orders', async (): Promise<void> => {
      typeOrmRepository.find.mockResolvedValue([]);

      const result: Order[] = await repository.findAllActive();

      expect(result).toEqual([]);
      expect(typeOrmRepository.find).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.find).toHaveBeenCalledWith({
        where: {
          active: true,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });

    it('should propagate repository find error', async (): Promise<void> => {
      const error: Error = new Error('Find all error');

      typeOrmRepository.find.mockRejectedValue(error);

      await expect(repository.findAllActive()).rejects.toThrow(
        'Find all error',
      );

      expect(typeOrmRepository.find).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.find).toHaveBeenCalledWith({
        where: {
          active: true,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });
  });
});
