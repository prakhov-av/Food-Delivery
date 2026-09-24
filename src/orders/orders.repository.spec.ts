import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Order } from './order.entity';
import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', (): void => {
  let repository: OrdersRepository;
  let typeOrmRepository: jest.Mocked<Repository<Order>>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersRepository,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get(OrdersRepository);
    typeOrmRepository = module.get(getRepositoryToken(Order));
  });

  it('should return only active orders from findAllActive', async (): Promise<void> => {
    typeOrmRepository.find.mockResolvedValue([]);

    await repository.findAllActive();

    expect(typeOrmRepository.find).toHaveBeenCalledWith({
      where: { active: true },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  });
});
