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
import { MenuItemsService } from './menu-items.service';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { MenuItemDto } from './dto/menu-item.dto';
import { MenuItemSaveDto } from './dto/menu-item.save-dto';
import { MenuItemUpdateDto } from './dto/menu-item.update-dto';
import { Roles } from '../auth/types/auth.decorators';
import { Role } from '../users/enums/role.enum';

import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly service: MenuItemsService) {}
  @Audit({
    action: AuditAction.CATALOG_CREATED,
    entityType: 'MenuItem',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: MenuItemDto,
  })
  async create(@Body() saveDto: MenuItemSaveDto): Promise<MenuItemDto> {
    return this.service.create(saveDto);
  }

  @Get()
  @ApiQuery({ name: 'menuId', required: false, type: Number })
  @ApiOkResponse({
    type: MenuItemDto,
    isArray: true,
  })
  async getAll(
    @Query('menuId', new ParseIntPipe({ optional: true }))
    menuId?: number,
  ): Promise<MenuItemDto[]> {
    return this.service.getAllActiveMenuItems(menuId);
  }

  @Get(':id')
  @ApiOkResponse({
    type: MenuItemDto,
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<MenuItemDto> {
    return this.service.getActiveMenuItemById(id);
  }

  @Audit({
    action: AuditAction.CATALOG_UPDATED,
    entityType: 'MenuItem',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: MenuItemUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Audit({
    action: AuditAction.CATALOG_DELETED,
    entityType: 'MenuItem',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.deleteById(id);
  }

  @Audit({
    action: AuditAction.CATALOG_RESTORED,
    entityType: 'MenuItem',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.restoreById(id);
  }
}
