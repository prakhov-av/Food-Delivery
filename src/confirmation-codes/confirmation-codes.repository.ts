import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfirmationCode } from './confirmation-code.entity';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class ConfirmationCodesRepository {
  constructor(
    @InjectRepository(ConfirmationCode)
    private readonly repository: Repository<ConfirmationCode>,
  ) {}

  async save(confirmationCode: ConfirmationCode): Promise<ConfirmationCode> {
    return this.repository.save(confirmationCode);
  }

  async findByValue(value: string): Promise<ConfirmationCode | null> {
    return this.repository.findOne({
      where: { value },
      relations: {
        user: true,
      },
    });
  }

  async delete(confirmationCode: ConfirmationCode): Promise<void> {
    await this.repository.delete(confirmationCode);
  }

  async deleteByUser(user: User): Promise<void> {
    await this.repository.delete({
      user: {
        id: user.id,
      },
    });
  }
}
