import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { MenusService } from './menus.service';
import { MenuDto } from './dto/menu.dto';
import { MenuSaveDto } from './dto/menu.save-dto';
import { MenuUpdateDto } from './dto/menu.update-dto';
import { Roles } from '../auth/types/auth.decorators';
import { Role } from '../users/enums/role.enum';

import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

/**
   * Обрабатывает HTTP-запросы соответствующего ресурса, валидирует входные DTO через инфраструктуру NestJS и делегирует бизнес-операции сервисам.
   */
@Controller('menus')
export class MenusController {
  constructor(private readonly service: MenusService) {}

  @Audit({
    action: AuditAction.CATALOG_CREATED,
    entityType: 'Menu',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: MenuDto,
  })
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async create(@Body() saveDto: MenuSaveDto): Promise<MenuDto> {
    return this.service.create(saveDto);
  }

  @Audit({
    action: AuditAction.CATALOG_UPDATED,
    entityType: 'Menu',
  })
  @Get()
  @ApiQuery({ name: 'restaurantId', required: false, type: Number })
  @ApiOkResponse({
    type: MenuDto,
    isArray: true,
  })
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getAll(
    @Query('restaurantId', new ParseIntPipe({ optional: true }))
    restaurantId?: number,
  ): Promise<MenuDto[]> {
    return this.service.getAllActiveMenus(restaurantId);
  }

  @Get(':id')
  @ApiOkResponse({
    type: MenuDto,
  })
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getById(@Param('id', ParseIntPipe) id: number): Promise<MenuDto> {
    return this.service.getActiveMenuById(id);
  }

  @Audit({
    action: AuditAction.CATALOG_DELETED,
    entityType: 'Menu',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: MenuUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Audit({
    action: AuditAction.CATALOG_DELETED,
    entityType: 'Menu',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async deleteById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.deleteById(id);
  }

  @Audit({
    action: AuditAction.CATALOG_RESTORED,
    entityType: 'Menu',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async restoreById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.restoreById(id);
  }
}
