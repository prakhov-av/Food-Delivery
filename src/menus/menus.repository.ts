import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Menu } from './menu.entity';

/**
   * Инкапсулирует операции доступа к данным соответствующего доменного ресурса.
   */
@Injectable()
export class MenusRepository {
  constructor(
    @InjectRepository(Menu)
    private readonly repository: Repository<Menu>,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(menu: Menu): Promise<Menu> {
    return this.repository.save(menu);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActive(): Promise<Menu[]> {
    return this.repository.findBy({ active: true });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findById(id: number): Promise<Menu | null> {
    return this.repository.findOneBy({ id });
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id)
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActiveByRestaurantId(restaurantId: number): Promise<Menu[]> {
    return this.repository.findBy({
      active: true,
      restaurant: { id: restaurantId },
    });
  }
}
