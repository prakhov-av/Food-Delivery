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
  UseGuards,
} from '@nestjs/common';

import { ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../auth/types/auth.decorators';
import { GuestSessionGuard } from '../guest-sessions/guest-session.guard';
import type { GuestSessionRequest } from '../guest-sessions/guest-session.request';

import { GuestOrdersService } from './guest-orders.service';
import { GuestOrderDto } from './dto/guest-order.dto';
import { GuestOrderCreateDto } from './dto/guest-order-create.dto';
import { GuestOrderItemDto } from './dto/guest-order-item.dto';
import { GuestOrderItemUpdateDto } from './dto/guest-order-item-update.dto';
import { GuestOrderStatusDto } from './dto/guest-order-status.dto';

/**
 * Оформление заказа гостем и выбор статуса заказа.
 *
 * Владелец заказа определяется cookie гостевой сессии:
 * клиент не передаёт ни guestSessionId, ни userId.
 */
@Controller('guest-orders')
@Public()
@UseGuards(GuestSessionGuard)
export class GuestOrdersController {
  constructor(private readonly service: GuestOrdersService) {}

  @Get()
  @ApiOkResponse({ type: GuestOrderDto, isArray: true })
  /**
   * Возвращает заказы текущей гостевой сессии вместе с позициями.
   */
  async getAll(@Req() req: GuestSessionRequest): Promise<GuestOrderDto[]> {
    return this.service.getGuestOrdersWithItems(req.guestSession);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: GuestOrderDto })
  /**
   * Создаёт черновик заказа в ресторане или возвращает существующий.
   */
  async create(
    @Body() createDto: GuestOrderCreateDto,
    @Req() req: GuestSessionRequest,
  ): Promise<GuestOrderDto> {
    return this.service.createDraft(req.guestSession, createDto.restaurantId);
  }

  @Post(':id/items')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: GuestOrderDto })
  /**
   * Добавляет позицию в заказ гостя.
   */
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() itemDto: GuestOrderItemDto,
    @Req() req: GuestSessionRequest,
  ): Promise<GuestOrderDto> {
    return this.service.addItem(
      req.guestSession,
      id,
      itemDto.menuItemId,
      itemDto.quantity,
    );
  }

  @Patch(':id/items/:itemId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ type: GuestOrderDto })
  /**
   * Изменяет количество позиции в заказе гостя.
   */
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateDto: GuestOrderItemUpdateDto,
    @Req() req: GuestSessionRequest,
  ): Promise<GuestOrderDto> {
    return this.service.updateItem(
      req.guestSession,
      id,
      itemId,
      updateDto.newQuantity,
    );
  }

  @Delete(':id/items/:itemId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ type: GuestOrderDto })
  /**
   * Удаляет позицию из заказа гостя.
   */
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: GuestSessionRequest,
  ): Promise<GuestOrderDto> {
    return this.service.removeItem(req.guestSession, id, itemId);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ type: GuestOrderDto })
  /**
   * Меняет статус заказа гостя.
   */
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() statusDto: GuestOrderStatusDto,
    @Req() req: GuestSessionRequest,
  ): Promise<GuestOrderDto> {
    return this.service.setGuestStatus(req.guestSession, id, statusDto.status);
  }
}
