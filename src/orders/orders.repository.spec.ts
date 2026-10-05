import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { OrdersRepository } from './orders.repository';
import { Order } from './order.entity';
import { Status } from './enums/status.enum';

describe('OrdersRepository', (): void => {
  let repository: OrdersRepository;
  let typeOrmRepository: jest.Mocked<Repository<Order>>;

  const ORDER: Order = {
    id: 1,
    customer: {
      id: 10,
    } as Order['customer'],
    courier: {
      id: 20,
    } as Order['courier'],
    restaurant: {
      id: 30,
    } as Order['restaurant'],
    status: Status.NEW,
    totalPrice: 100,
    createdAt: new Date(),
    items: [],
    active: true,
  };

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersRepository,
        {
          provide: 'OrderRepository',
          useValue: {
            save: jest.fn(),
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    })
      .overrideProvider('OrderRepository')
      .useValue({
        save: jest.fn(),
        findOneBy: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
      })
      .compile();

    repository = module.get<OrdersRepository>(OrdersRepository);
    typeOrmRepository = module.get('OrderRepository');

    jest.clearAllMocks();
  });

  describe('save', (): void => {
    it('should save and return an order', async (): Promise<void> => {
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
    it('should return an order by id', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(ORDER);

      const result: Order | null = await repository.findById(ORDER.id);

      expect(result).toBe(ORDER);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: ORDER.id,
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

    it('should propagate repository find error', async (): Promise<void> => {
      const error: Error = new Error('Find error');

      typeOrmRepository.findOneBy.mockRejectedValue(error);

      await expect(repository.findById(ORDER.id)).rejects.toThrow('Find error');

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByIdWithRelations', (): void => {
    it('should return an order with required relations', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(ORDER);

      const result: Order | null = await repository.findByIdWithRelations(
        ORDER.id,
      );

      expect(result).toBe(ORDER);
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: ORDER.id,
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

    it('should propagate repository find error', async (): Promise<void> => {
      const error: Error = new Error('Find with relations error');

      typeOrmRepository.findOne.mockRejectedValue(error);

      await expect(repository.findByIdWithRelations(ORDER.id)).rejects.toThrow(
        'Find with relations error',
      );

      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('findActiveDraft', (): void => {
    it('should return an active draft for customer and restaurant', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(ORDER);

      const result: Order | null = await repository.findActiveDraft(10, 30);

      expect(result).toBe(ORDER);
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          active: true,
          status: Status.NEW,
          customer: {
            id: 10,
          },
          restaurant: {
            id: 30,
          },
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });

    it('should return null when there is no active draft', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(null);

      const result: Order | null = await repository.findActiveDraft(999, 999);

      expect(result).toBeNull();
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          active: true,
          status: Status.NEW,
          customer: {
            id: 999,
          },
          restaurant: {
            id: 999,
          },
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });
    });

    it('should propagate repository find error', async (): Promise<void> => {
      const error: Error = new Error('Find draft error');

      typeOrmRepository.findOne.mockRejectedValue(error);

      await expect(repository.findActiveDraft(10, 30)).rejects.toThrow(
        'Find draft error',
      );

      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
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
