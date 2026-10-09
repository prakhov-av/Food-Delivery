import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { InjectRepository } from '@nestjs/typeorm';

/**
   * Инкапсулирует операции доступа к данным соответствующего доменного ресурса.
   */
@Injectable()
export class RestaurantsRepository {
  constructor(
    @InjectRepository(Restaurant)
    private readonly repository: Repository<Restaurant>,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(restaurant: Restaurant): Promise<Restaurant> {
    return this.repository.save(restaurant);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAllActive(): Promise<Restaurant[]> {
    return this.repository.findBy({ active: true });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findById(id: number): Promise<Restaurant | null> {
    return this.repository.findOneBy({ id });
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async isPhoneExists(phone: string): Promise<boolean> {
    return this.repository.existsBy({ phone });
  }
}
