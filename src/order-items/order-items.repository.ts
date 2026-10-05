import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderItem } from './order-item.entity';

@Injectable()
export class OrderItemsRepository {
  constructor(
    @InjectRepository(OrderItem)
    private readonly repository: Repository<OrderItem>,
  ) {}

  async save(orderItem: OrderItem): Promise<OrderItem> {
    return this.repository.save(orderItem);
  }

  async findAllActive(): Promise<OrderItem[]> {
    return this.repository.find({
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
  }

  async findById(id: number): Promise<OrderItem | null> {
    return this.repository.findOne({
      where: {
        id,
      },
      relations: {
        menuItem: true,
        order: {
          customer: true,
          courier: true,
        },
      },
    });
  }

  async findAllActiveByOrderId(orderId: number): Promise<OrderItem[]> {
    return this.repository.find({
      where: {
        active: true,
        order: {
          id: orderId,
        },
      },
      relations: {
        menuItem: true,
      },
    });
  }
}
