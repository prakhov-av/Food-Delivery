import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
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
      relations: {
        menuItem: true,
        order: true,
      },
    });
  }

  async findById(id: number): Promise<OrderItem | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        menuItem: true,
        order: true,
      },
    });
  }

  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
