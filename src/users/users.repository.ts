import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from './user.entity';
import { Role } from './enums/role.enum';

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
    return this.repository.findOne({
      where: {
        role: Role.COURIER,
        active: true,
      },
    });
  }
}
