import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Menu } from './menu.entity';

@Injectable()
export class MenusRepository {
  constructor(
    @InjectRepository(Menu)
    private readonly repository: Repository<Menu>,
  ) {}

  async save(menu: Menu): Promise<Menu> {
    return this.repository.save(menu);
  }

  async findAllActive(): Promise<Menu[]> {
    return this.repository.findBy({ active: true });
  }

  async findById(id: number): Promise<Menu | null> {
    return this.repository.findOneBy({ id });
  }

  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
