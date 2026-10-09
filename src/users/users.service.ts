import { Injectable, Logger } from '@nestjs/common';

import { UsersRepository } from './users.repository';
import { User } from './user.entity';
import { Role } from './enums/role.enum';
import { UserDto } from './dto/user.dto';
import { UsersMapper } from './dto/users.mapper';
import { UserSaveDto } from './dto/user.save-dto';
import { UserUpdateDto } from './dto/user.update-dto';

import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { UserIsNotConfirmedException } from '../exceptions/types/user-is-not-confirmed.exception';

import * as bcrypt from 'bcrypt';

import { RegistrationException } from '../exceptions/types/registration.exception';
import { EmailService } from '../email/email.service';
import { ConfirmationCodesService } from '../confirmation-codes/confirmation-codes.service';

import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.enums';

/**
   * Реализует пользовательские сценарии: создание и изменение учётных записей, управление ролями, регистрацию, подтверждение и деактивацию пользователей.
   */
@Injectable()
export class UsersService {
  private readonly logger: Logger = new Logger(UsersService.name);

  constructor(
    private readonly repository: UsersRepository,
    private readonly mapper: UsersMapper,
    private readonly emailService: EmailService,
    private readonly confirmationCodeService: ConfirmationCodesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async create(saveDto: UserSaveDto): Promise<UserDto> {
    if (await this.repository.isEmailExists(saveDto.email)) {
      throw new EntitySaveException(User.name, 'email');
    }

    const entity: User = this.mapper.mapDtoToEntity(saveDto);

    entity.password = await bcrypt.hash(entity.password, 10);
    entity.role = Role.CUSTOMER;
    entity.active = true;

    await this.repository.save(entity);

    this.logger.log(`User created: id=${entity.id}`);

    return this.mapper.mapEntityToDto(entity);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getAllActiveUsers(role?: Role): Promise<UserDto[]> {
    const users: User[] = (await this.repository.findAllActive()).filter(
      (user: User): boolean => role === undefined || user.role === role,
    );

    if (users.length === 0) {
      throw new EntityNotFoundException(User.name);
    }

    return this.mapper.mapEntityListToDtoList(users);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getActiveUserById(id: number): Promise<UserDto> {
    const user: User = await this.getActiveEntityById(id);

    return this.mapper.mapEntityToDto(user);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getActiveEntityById(id: number): Promise<User> {
    const user: User | null = await this.repository.findById(id);

    if (!user || !user.active) {
      throw new EntityNotFoundException(User.name, id);
    }

    return user;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async update(id: number, updateDto: UserUpdateDto): Promise<void> {
    const foundUser: User = await this.getActiveEntityById(id);

    if (foundUser) {
      foundUser.name = updateDto.newName;

      await this.repository.save(foundUser);

      this.logger.log(`User updated: id=${id}`);
    } else {
      throw new EntityNotFoundException(User.name, id);
    }
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(id: number, actorId: number): Promise<void> {
    if (id === actorId) {
      throw new EntityUpdateException('You cannot deactivate your own account');
    }

    const user: User = await this.getActiveEntityById(id);

    user.active = false;
    user.deletedAt = new Date();

    await this.repository.save(user);

    this.logger.log(`User marked as inactive: id ${id}`);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async restoreById(id: number): Promise<void> {
    const user: User | null = await this.repository.findById(id);

    if (!user) {
      throw new EntityNotFoundException(User.name, id);
    }

    if (user.active) {
      return;
    }

    user.active = true;
    user.deletedAt = null;

    await this.repository.save(user);

    this.logger.log(`User marked as active: id ${id}`);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async setRole(id: number, role: Role, actorId: number): Promise<void> {
    if (id === actorId) {
      throw new EntityUpdateException('You cannot change your own role');
    }

    const user: User = await this.getActiveEntityById(id);

    if (user.role === role) {
      throw new EntityUpdateException(`User id ${id} already has role ${role}`);
    }

    user.role = role;

    await this.repository.save(user);

    this.logger.log(`User updated: ${id}, new role ${role}`);
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getConfirmedByEmail(email: string): Promise<User> {
    const user: User | null = await this.repository.findByEmail(email);

    if (!user) {
      throw new EntityNotFoundException(User.name, undefined, email);
    }

    if (!user.active) {
      throw new UserIsNotConfirmedException(email);
    }

    return user;
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async register(registrationDto: UserSaveDto): Promise<void> {
    const email: string = registrationDto.email;

    let user: User | null = await this.repository.findByEmail(email);

    if (!user) {
      user = new User();

      user.email = email;
      user.active = false;
    } else if (user.active) {
      throw new RegistrationException(`Email ${email} already in use`);
    } else if (user.deletedAt) {
      throw new RegistrationException(`Email ${email} cannot be registered`);
    }

    // Незавершённая регистрация всегда оформляется как клиент.
    user.role = Role.CUSTOMER;
    user.password = await bcrypt.hash(registrationDto.password, 10);
    user.name = registrationDto.name;
    user.phone = registrationDto.phone;

    await this.repository.save(user);

    await this.audit.record({
      action: AuditAction.USER_REGISTERED,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      details: { email },
    });

    await this.emailService.sendConfirmationEmail(user);
  }

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async confirmRegistration(codeValue: string): Promise<void> {
    const user: User =
      await this.confirmationCodeService.validateCodeAndGetUser(codeValue);

    if (user.deletedAt) {
      throw new RegistrationException('Account is deactivated');
    }

    user.active = true;

    await this.repository.save(user);

    await this.audit.record({
      action: AuditAction.USER_CONFIRMED,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
    });
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findAvailableCourier(): Promise<User | null> {
    return this.repository.findAvailableCourier();
  }
}
