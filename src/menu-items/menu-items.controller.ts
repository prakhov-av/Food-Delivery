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
import { MenuItem } from './menu-item.entity';

@Controller('menu-items')
export class MenuItemsController {
  @Post()
  create(@Body() menuItem: MenuItem): MenuItem {
    console.log('Saved menu item:', menuItem);
    return menuItem;
  }

  @Get()
  getAll(): MenuItem[] {
    const firstItem = new MenuItem();
    firstItem.name = 'Burger';
    const secondItem = new MenuItem();
    secondItem.name = 'Pizza';
    return [firstItem, secondItem];
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number): MenuItem {
    console.log('ID:', id);
    const menuItem = new MenuItem();
    menuItem.name = 'Burger';
    return menuItem;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() menuItem: MenuItem,
  ): void {
    console.log('ID:', id);
    console.log('New name:', menuItem.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteById(@Param('id', ParseIntPipe) id: number): void {
    console.log('ID:', id);
  }
}
