import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MenuItem } from './menu-item.entity';

/**
   * Инкапсулирует операции доступа к данным соответствующего доменного ресурса.
   */
@Injectable()
export class MenuItemsRepository {
  constructor(
    @InjectRepository(MenuItem)
    private readonly repository: Repository<MenuItem>,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(menuItem: MenuItem): Promise<MenuItem> {
    return this.repository.save(menuItem);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActive(): Promise<MenuItem[]> {
    return this.repository.findBy({ active: true });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findById(id: number): Promise<MenuItem | null> {
    return this.repository.findOneBy({ id });
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActiveByMenuId(menuId: number): Promise<MenuItem[]> {
    return this.repository.findBy({
      active: true,
      menu: { id: menuId },
    });
  }
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findByIdWithRestaurant(id: number): Promise<MenuItem | null> {
    return this.repository.findOne({
      where: { id },
      relations: { menu: { restaurant: true } },
    });
  }
}
