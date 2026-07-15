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
import { ApiOkResponse } from '@nestjs/swagger';
import { MenusService } from './menus.service';
import { MenuDto } from './dto/menu.dto';
import { MenuSaveDto } from './dto/menu.save-dto';
import { MenuUpdateDto } from './dto/menu.update-dto';

@Controller('menus')
export class MenusController {
  constructor(private readonly service: MenusService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: MenuDto,
  })
  async create(@Body() saveDto: MenuSaveDto): Promise<MenuDto> {
    return this.service.create(saveDto);
  }

  @Get()
  @ApiOkResponse({
    type: MenuDto,
    isArray: true,
  })
  async getAll(): Promise<MenuDto[]> {
    return this.service.getAllActiveMenus();
  }

  @Get(':id')
  @ApiOkResponse({
    type: MenuDto,
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<MenuDto> {
    return this.service.getActiveMenuById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: MenuUpdateDto,
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
