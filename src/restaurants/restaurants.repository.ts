import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class RestaurantsRepository {
  constructor(
    @InjectRepository(Restaurant)
    private readonly repository: Repository<Restaurant>,
  ) {}

  async save(restaurant: Restaurant): Promise<Restaurant> {
    return this.repository.save(restaurant);
  }

  async findAllActive(): Promise<Restaurant[]> {
    return this.repository.findBy({ active: true });
  }

  async findById(id: number): Promise<Restaurant | null> {
    return this.repository.findOneBy({ id });
  }

  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
