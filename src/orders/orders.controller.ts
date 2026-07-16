import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Status } from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';
import { OrdersService } from './orders.service';
import { ApiOkResponse } from '@nestjs/swagger';
import { OrderDto } from './dto/order.dto';
import { OrderSaveDto } from './dto/order.save-dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: OrderDto,
  })
  async create(@Body() saveDto: OrderSaveDto): Promise<OrderDto> {
    return this.service.create(saveDto);
  }

  @Get()
  @ApiOkResponse({
    type: OrderDto,
    isArray: true,
  })
  async getAll(): Promise<OrderDto[]> {
    return this.service.getAllOrders();
  }

  @Get(':id')
  @ApiOkResponse({
    type: OrderDto,
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<OrderDto> {
    return this.service.getOrderById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: OrderUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Patch(':id/set-status/:status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status', new ParseEnumPipe(Status)) status: Status,
  ): Promise<void> {
    await this.service.setStatus(id, status);
  }
}
