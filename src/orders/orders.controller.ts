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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiOkResponse } from '@nestjs/swagger';

import { Status } from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';
import { OrdersService } from './orders.service';
import { OrderDto } from './dto/order.dto';
import { OrderSaveDto } from './dto/order.save-dto';
import { User } from '../users/user.entity';

import { Role } from '../users/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
  constructor(
      private readonly service: OrdersService,
  ) {}

  @Post()
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: OrderDto,
  })
  async create(
      @Body() saveDto: OrderSaveDto,
      @Req() req: Request & { user: User },
  ): Promise<OrderDto> {
    return this.service.create(
        saveDto,
        req.user,
    );
  }

  @Get()
  @ApiOkResponse({
    type: OrderDto,
    isArray: true,
  })
  async getAll(
      @Req() req: Request & { user: User },
  ): Promise<OrderDto[]> {
    return this.service.getAllOrders(
        req.user,
    );
  }

  @Get(':id')
  @ApiOkResponse({
    type: OrderDto,
  })
  async getById(
      @Param('id', ParseIntPipe) id: number,
      @Req() req: Request & { user: User },
  ): Promise<OrderDto> {
    return this.service.getOrderById(
        id,
        req.user,
    );
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
      @Param('id', ParseIntPipe) id: number,
      @Body() updateDto: OrderUpdateDto,
  ): Promise<void> {
    await this.service.update(
        id,
        updateDto,
    );
  }

  @Patch(':id/set-status/:status')
  @Roles(
      Role.ADMIN,
      Role.MANAGER,
      Role.COURIER,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  async setStatus(
      @Param('id', ParseIntPipe) id: number,
      @Param(
          'status',
          new ParseEnumPipe(Status),
      )
      status: Status,
      @Req() req: Request & { user: User },
  ): Promise<void> {
    await this.service.setStatus(
        id,
        status,
        req.user,
    );
  }
}