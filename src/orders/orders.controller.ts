import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Order } from './order.entity';
import { Status } from './enums/status.enum';

@Controller('orders')
export class OrdersController {
  @Post()
  create(@Body() order: Order): Order {
    console.log('Saved order:', order);
    return order;
  }

  @Get()
  getAll(): Order[] {
    const firstOrder = new Order();
    firstOrder.status = Status.CREATED;
    const secondOrder = new Order();
    secondOrder.status = Status.ACCEPTED;
    return [firstOrder, secondOrder];
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number): Order {
    console.log('ID:', id);
    const order = new Order();
    order.status = Status.CREATED;
    return order;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(@Param('id', ParseIntPipe) id: number, @Body() order: Order): void {
    console.log('ID:', id);
    console.log('New status:', order.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteById(@Param('id', ParseIntPipe) id: number): void {
    console.log('ID:', id);
  }

  @Patch(':id/set-status/:status')
  @HttpCode(HttpStatus.NO_CONTENT)
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status', new ParseEnumPipe(Status)) status: Status,
  ): void {
    console.log('ID:', id);
    console.log('Status:', status);
  }
}
