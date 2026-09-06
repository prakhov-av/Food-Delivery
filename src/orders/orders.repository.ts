import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Repository } from 'typeorm';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly repository: Repository<Order>,
  ) {}

  async save(order: Order): Promise<Order> {
    return this.repository.save(order);
  }

  async findById(id: number): Promise<Order | null> {
    return this.repository.findOneBy({ id });
  }

  async findByIdWithRelations(id: number): Promise<Order | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  }

  async findAllActive(): Promise<Order[]> {
    return this.repository.find();
  }
}
