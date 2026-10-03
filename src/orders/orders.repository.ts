import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { In, Repository } from 'typeorm';
import { Status } from './enums/status.enum';
import { OrderItem } from '../order-items/order-item.entity';

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

  async findActiveDraft(
    customerId: number,
    restaurantId: number,
  ): Promise<Order | null> {
    return this.repository.findOne({
      where: {
        active: true,
        status: Status.NEW,
        customer: { id: customerId },
        restaurant: { id: restaurantId },
      },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  }

  async findAllActive(): Promise<Order[]> {
    return this.repository.find({
      where: { active: true },
      relations: {
        customer: true,
        courier: true,
        restaurant: true,
      },
    });
  }

  async countActiveItems(orderId: number): Promise<number> {
    return this.repository.manager.count(OrderItem, {
      where: { order: { id: orderId }, active: true },
    });
  }

  async countSubmittedByCustomerId(customerId: number): Promise<number> {
    return this.repository.count({
      where: {
        active: true,
        customer: { id: customerId },
        status: In([
          Status.CREATED,
          Status.ACCEPTED,
          Status.COOKING,
          Status.READY,
          Status.DELIVERING,
        ]),
      },
    });
  }
}