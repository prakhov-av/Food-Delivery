import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfirmationCode } from './confirmation-code.entity';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

/**
   * Инкапсулирует операции доступа к данным соответствующего доменного ресурса.
   */
@Injectable()
export class ConfirmationCodesRepository {
  constructor(
    @InjectRepository(ConfirmationCode)
    private readonly repository: Repository<ConfirmationCode>,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async save(confirmationCode: ConfirmationCode): Promise<ConfirmationCode> {
    return this.repository.save(confirmationCode);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findByValue(value: string): Promise<ConfirmationCode | null> {
    return this.repository.findOne({
      where: { value },
      relations: {
        user: true,
      },
    });
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async delete(confirmationCode: ConfirmationCode): Promise<void> {
    await this.repository.delete(confirmationCode);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteByUser(user: User): Promise<void> {
    await this.repository.delete({
      user: {
        id: user.id,
      },
    });
  }
}
