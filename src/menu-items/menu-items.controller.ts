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
} from '@nestjs/common';
import { MenuItemsService } from './menu-items.service';
import { ApiOkResponse } from '@nestjs/swagger';
import { MenuItemDto } from './dto/menu-item.dto';
import { MenuItemSaveDto } from './dto/menu-item.save-dto';
import { MenuItemUpdateDto } from './dto/menu-item.update-dto';

@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly service: MenuItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: MenuItemDto,
  })
  async create(@Body() saveDto: MenuItemSaveDto): Promise<MenuItemDto> {
    return this.service.create(saveDto);
  }

  @Get()
  @ApiOkResponse({
    type: MenuItemDto,
    isArray: true,
  })
  async getAll(): Promise<MenuItemDto[]> {
    return this.service.getAllActiveMenuItems();
  }

  @Get(':id')
  @ApiOkResponse({
    type: MenuItemDto,
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<MenuItemDto> {
    return this.service.getActiveMenuItemById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: MenuItemUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.deleteById(id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.restoreById(id);
  }
}
