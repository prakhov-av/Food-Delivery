import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import express from 'express';
import { Public } from './types/auth.decorators';
import { TokenResponseDto } from './dto/token-response.dto';
import { ApiOkResponse } from '@nestjs/swagger';
import { UserDto } from '../users/dto/user.dto';
import type { AuthenticatedRequest } from './types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResult } from '../audit/audit.enums';
import { resolveAccountTracker } from '../security/client-ip';

/**
 * Обрабатывает HTTP-запросы соответствующего ресурса, валидирует входные DTO через инфраструктуру NestJS и делегирует бизнес-операции сервисам.
 */
@Controller('/auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Get('/me')
  @ApiOkResponse({ type: UserDto })
  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  me(@Req() request: AuthenticatedRequest): UserDto {
    const { id, name, role, phone } = request.user;
    return { id, name, role, phone };
  }

  @Public()
  /**
   * Лимит на попытки входа считается по конкретной учётной записи,
   * а не по адресу: через Cloudflare адрес общий у всех посетителей,
   * и иначе один человек блокировал бы вход всем остальным.
   */
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
      getTracker: (request) =>
        resolveAccountTracker(request as express.Request),
    },
    ip: { limit: 20, ttl: 60_000 },
  })
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async login(
    @Body() loginDto: LoginRequestDto,
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ): Promise<void> {
    try {
      const tokens: TokenResponseDto = await this.service.login(loginDto);

      this.setTokenCookiesToResponse(
        response,
        tokens.accessToken,
        tokens.refreshToken,
      );

      await this.audit.record({
        action: AuditAction.AUTH_LOGIN,
        actorId: tokens.userId,
        actorRole: tokens.role,
        entityType: 'User',
        entityId: tokens.userId,
        details: { email: loginDto.email },
        request,
      });
    } catch (error) {
      await this.audit.record({
        action: AuditAction.AUTH_LOGIN,
        entityType: 'User',
        result: AuditResult.FAILED,
        details: { email: loginDto.email },
        request,
      });

      throw error;
    }
  }

  @Public()
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async refresh(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ): Promise<void> {
    const accessToken: string = await this.service.refreshAccessToken(
      request.headers.cookie,
    );

    this.setTokenCookiesToResponse(response, accessToken);
  }

  private setTokenCookiesToResponse(
    response: express.Response,
    accessToken: string,
    refreshToken?: string,
  ): void {
    /**
     * Path=/ обязателен: без него cookie привязывается к каталогу
     * запроса (для /auth/login это /auth), и браузер не примет её
     * для остальных адресов. Фронт ходит в API через /api,
     * поэтому путь cookie должен быть корнем сайта.
     */
    response.cookie('access-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'test',
      sameSite: process.env.NODE_ENV === 'test' ? 'lax' : 'none',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    if (refreshToken) {
      response.cookie('refresh-token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'test',
        sameSite: process.env.NODE_ENV === 'test' ? 'lax' : 'none',
        path: '/',
        maxAge: 12 * 60 * 60 * 1000,
      });
    }
  }

  @Public()
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  logout(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ): void {
    this.service.revokeRefreshToken(request.headers.cookie);

    response.clearCookie('access-token', { path: '/' });
    response.clearCookie('refresh-token', { path: '/' });
  }
}
