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
import { OrderItem } from './order-item.entity';
import { MenuItem } from '../menu-items/menu-item.entity';

@Controller('order-items')
export class OrdersItemsController {
  @Post()
  create(@Body() orderItem: OrderItem): OrderItem {
    console.log('Saved menu item:', orderItem);
    return orderItem;
  }

  @Get()
  getAll(): OrderItem[] {
    const menuItem = new MenuItem();
    menuItem.name = 'Burger';

    const firstItem = new OrderItem();
    firstItem.menuItem = menuItem;
    firstItem.quantity = 2;
    firstItem.price = 10;

    const secondItem = new OrderItem();
    secondItem.menuItem = menuItem;
    secondItem.quantity = 3;
    secondItem.price = 20;

    return [firstItem, secondItem];
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number): OrderItem {
    const menuItem = new MenuItem();
    menuItem.name = 'Burger';

    const orderItem = new OrderItem();
    orderItem.menuItem = menuItem;
    orderItem.quantity = 2;
    orderItem.price = 10;

    return orderItem;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() orderItem: OrderItem,
  ): void {
    console.log('ID:', id);
    console.log('Updated order item:', orderItem);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteById(@Param('id', ParseIntPipe) id: number): void {
    console.log('ID:', id);
  }
}
