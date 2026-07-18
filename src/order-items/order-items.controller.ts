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
import { OrderItemsService } from './order-items.service';
import { OrderItemDto } from './dto/order-item.dto';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';

@Controller('order-items')
export class OrderItemsController {
  constructor(private readonly service: OrderItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: OrderItemDto,
  })
  async create(@Body() saveDto: OrderItemSaveDto): Promise<OrderItemDto> {
    return this.service.create(saveDto);
  }

  @Get()
  @ApiOkResponse({
    type: OrderItemDto,
    isArray: true,
  })
  async getAll(): Promise<OrderItemDto[]> {
    return this.service.getAllActiveOrderItems();
  }

  @Get(':id')
  @ApiOkResponse({
    type: OrderItemDto,
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<OrderItemDto> {
    return this.service.getActiveOrderItemById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: OrderItemUpdateDto,
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
