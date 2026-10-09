import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from './enums/role.enum';
import { UsersService } from './users.service';
import { UserDto } from './dto/user.dto';
import { UserSaveDto } from './dto/user.save-dto';
import { UserUpdateDto } from './dto/user.update-dto';
import { Public, Roles } from '../auth/types/auth.decorators';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

// localhost:3000/users
/**
   * Обрабатывает HTTP-запросы соответствующего ресурса, валидирует входные DTO через инфраструктуру NestJS и делегирует бизнес-операции сервисам.
   */
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Audit({
    action: AuditAction.USER_CREATED,
    entityType: 'User',
    includeBody: false,
  })
  @Roles(Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: UserDto })
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async create(@Body() saveDto: UserSaveDto): Promise<UserDto> {
    return this.service.create(saveDto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  @ApiOkResponse({ type: UserDto, isArray: true })
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getAll(
    @Req() request: AuthenticatedRequest,
    @Query('role', new ParseEnumPipe(Role, { optional: true })) role?: Role,
  ): Promise<UserDto[]> {
    // Менеджеру нужны только курьеры (назначение на заказ).
    const effectiveRole: Role | undefined =
      request.user.role === Role.MANAGER ? Role.COURIER : role;

    return this.service.getAllActiveUsers(effectiveRole);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id')
  @ApiOkResponse({ type: UserDto })
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserDto> {
    const user: UserDto = await this.service.getActiveUserById(id);

    if (request.user.role === Role.MANAGER && user.role !== Role.COURIER) {
      throw new ForbiddenException('Manager can access couriers only');
    }

    return user;
  }

  @Audit({ action: AuditAction.USER_UPDATED, entityType: 'User' })
  @Roles(Role.ADMIN)
  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UserUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Audit({ action: AuditAction.USER_DELETED, entityType: 'User' })
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.deleteById(id, request.user.id);
  }

  @Audit({ action: AuditAction.USER_RESTORED, entityType: 'User' })
  @Roles(Role.ADMIN)
  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async restoreById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.restoreById(id);
  }

  // PATCH 10.20.30.40:3000/users/5/set-role/ADMIN
  @Audit({ action: AuditAction.USER_ROLE_CHANGED, entityType: 'User' })
  @Roles(Role.ADMIN)
  @Patch(':id/set-role/:role')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async setRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('role', new ParseEnumPipe(Role)) role: Role,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.setRole(id, role, request.user.id);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async register(@Body() registrationDto: UserSaveDto): Promise<string> {
    await this.service.register(registrationDto);
    return 'Registration complete. Check your email.';
  }

  @Public()
  @Get('confirm/:codeValue')
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async confirmRegistration(
    @Param('codeValue') codeValue: string,
  ): Promise<string> {
    await this.service.confirmRegistration(codeValue);
    return 'Registration confirmed';
  }
}
