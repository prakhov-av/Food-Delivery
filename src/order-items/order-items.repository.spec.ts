import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderItem } from './order-item.entity';
import { OrderItemsRepository } from './order-items.repository';

describe('OrderItemsRepository', (): void => {
  let repository: OrderItemsRepository;
  let typeOrmRepository: jest.Mocked<Repository<OrderItem>>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderItemsRepository,
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<OrderItemsRepository>(OrderItemsRepository);
    typeOrmRepository = module.get<Repository<OrderItem>>(
      getRepositoryToken(OrderItem),
    ) as jest.Mocked<Repository<OrderItem>>;
  });

  describe('save', (): void => {
    it('should save order item', async (): Promise<void> => {
      const orderItem: OrderItem = {
        id: 1,
        quantity: 2,
      } as OrderItem;

      typeOrmRepository.save.mockResolvedValue(orderItem);

      const result: OrderItem = await repository.save(orderItem);

      expect(typeOrmRepository.save).toHaveBeenCalledWith(orderItem);
      expect(result).toBe(orderItem);
    });
  });

  describe('findAllActive', (): void => {
    it('should return only active order items with all required relations', async (): Promise<void> => {
      const orderItems: OrderItem[] = [
        {
          id: 1,
          quantity: 2,
          active: true,
        } as OrderItem,
      ];

      typeOrmRepository.find.mockResolvedValue(orderItems);

      const result: OrderItem[] = await repository.findAllActive();

      expect(typeOrmRepository.find).toHaveBeenCalledWith({
        where: {
          active: true,
        },
        relations: {
          menuItem: true,
          order: {
            customer: true,
            courier: true,
          },
        },
      });
      expect(result).toBe(orderItems);
    });
  });

  describe('findById', (): void => {
    it('should return order item by id with all required relations', async (): Promise<void> => {
      const orderItem: OrderItem = {
        id: 1,
        quantity: 2,
      } as OrderItem;

      typeOrmRepository.findOne.mockResolvedValue(orderItem);

      const result: OrderItem | null = await repository.findById(1);

      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        relations: {
          menuItem: true,
          order: {
            courier: true,
            customer: true,
          },
        },
      });

      expect(result).toBe(orderItem);
    });

    it('should return null when order item does not exist', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(null);

      const result: OrderItem | null = await repository.findById(999);

      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
        relations: {
          menuItem: true,
          order: {
            courier: true,
            customer: true,
          },
        },
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteById', (): void => {
    it('should delete order item by id', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
        raw: {},
      } as never);

      await repository.deleteById(1);

      expect(typeOrmRepository.delete).toHaveBeenCalledWith(1);
    });
  });
});
