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
import { Throttle } from '@nestjs/throttler';

import { Status } from './enums/status.enum';
import { OrderUpdateDto } from './dto/order.update-dto';
import { OrdersService } from './orders.service';
import { OrderDto } from './dto/order.dto';
import { OrderSaveDto } from './dto/order.save-dto';
import { User } from '../users/user.entity';

import { Role } from '../users/enums/role.enum';
import { Roles } from '../auth/types/auth.decorators';
import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

/**
   * Обрабатывает HTTP-запросы соответствующего ресурса, валидирует входные DTO через инфраструктуру NestJS и делегирует бизнес-операции сервисам.
   */
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // Запись в журнал пишет сам сервис: только при реальном создании.
  @Post()
  @Roles(Role.CUSTOMER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: OrderDto,
  })
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async create(
    @Body() saveDto: OrderSaveDto,
    @Req() req: Request & { user: User },
  ): Promise<OrderDto> {
    return this.service.create(saveDto, req.user);
  }

  @Get()
  @ApiOkResponse({
    type: OrderDto,
    isArray: true,
  })
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getAll(@Req() req: Request & { user: User }): Promise<OrderDto[]> {
    return this.service.getAllOrders(req.user);
  }

  @Get(':id')
  @ApiOkResponse({
    type: OrderDto,
  })
  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
  ): Promise<OrderDto> {
    return this.service.getOrderById(id, req.user);
  }

  // Ручная смена курьера. В журнале: исполнитель, id заказа и courierId из тела запроса.
  @Audit({ action: AuditAction.ORDER_COURIER_ASSIGNED, entityType: 'Order' })
  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: OrderUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  // Журнал пишется внутри сервиса (нужен прежний статус), декоратор не нужен.
  @Patch(':id/set-status/:status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.COURIER, Role.CUSTOMER)
  @HttpCode(HttpStatus.NO_CONTENT)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('status', new ParseEnumPipe(Status))
    status: Status,
    @Req() req: Request & { user: User },
  ): Promise<void> {
    await this.service.setStatus(id, status, req.user);
  }
}
