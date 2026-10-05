import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from './user.entity';
import { Role } from './enums/role.enum';
import { Status } from '../orders/enums/status.enum';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  async findAllActive(): Promise<User[]> {
    return this.repository.findBy({
      active: true,
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async isEmailExists(email: string): Promise<boolean> {
    return this.repository.existsBy({ email });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  async findAvailableCourier(): Promise<User | null> {
    return this.repository
      .createQueryBuilder('courier')
      .where('courier.role = :role', { role: Role.COURIER })
      .andWhere('courier.active = :active', { active: true })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.courier_id = courier.id
            AND o.active = true
            AND o.order_status IN (:...busyStatuses)
        )`,
        { busyStatuses: [Status.READY, Status.DELIVERING] },
      )
      .orderBy('courier.id', 'ASC')
      .getOne();
  }
}
