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
  Req,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { Request } from 'express';

import { OrderItemsService } from './order-items.service';
import { OrderItemDto } from './dto/order-item.dto';
import { OrderItemSaveDto } from './dto/order-item.save-dto';
import { OrderItemUpdateDto } from './dto/order-item.update-dto';
import { User } from '../users/user.entity';

import { Roles } from '../auth/types/auth.decorators';
import { Role } from '../users/enums/role.enum';

@Controller('order-items')
export class OrderItemsController {
  constructor(private readonly service: OrderItemsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: OrderItemDto,
  })
  async create(
    @Body() saveDto: OrderItemSaveDto,
    @Req() req: Request & { user: User },
  ): Promise<OrderItemDto> {
    return this.service.create(saveDto, req.user);
  }

  @Get()
  @ApiOkResponse({
    type: OrderItemDto,
    isArray: true,
  })
  async getAll(@Req() req: Request & { user: User }): Promise<OrderItemDto[]> {
    return this.service.getAllActiveOrderItems(req.user);
  }

  @Get(':id')
  @ApiOkResponse({
    type: OrderItemDto,
  })
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
  ): Promise<OrderItemDto> {
    return this.service.getActiveOrderItemById(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CUSTOMER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: OrderItemUpdateDto,
    @Req() req: Request & { user: User },
  ): Promise<void> {
    await this.service.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CUSTOMER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
  ): Promise<void> {
    await this.service.deleteById(id, req.user);
  }

  @Patch(':id/restore')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CUSTOMER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
  ): Promise<void> {
    await this.service.restoreById(id, req.user);
  }
}
