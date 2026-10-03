import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MenuItem } from './menu-item.entity';

@Injectable()
export class MenuItemsRepository {
  constructor(
    @InjectRepository(MenuItem)
    private readonly repository: Repository<MenuItem>,
  ) {}

  async save(menuItem: MenuItem): Promise<MenuItem> {
    return this.repository.save(menuItem);
  }

  async findAllActive(): Promise<MenuItem[]> {
    return this.repository.findBy({ active: true });
  }

  async findById(id: number): Promise<MenuItem | null> {
    return this.repository.findOneBy({ id });
  }

  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async findAllActiveByMenuId(menuId: number): Promise<MenuItem[]> {
    return this.repository.findBy({
      active: true,
      menu: { id: menuId },
    });
  }
  async findByIdWithRestaurant(id: number): Promise<MenuItem | null> {
    return this.repository.findOne({
      where: { id },
      relations: { menu: { restaurant: true } },
    });
  }
}
