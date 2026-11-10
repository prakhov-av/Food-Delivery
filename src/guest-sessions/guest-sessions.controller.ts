import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/types/auth.decorators';
import type { Request, Response } from 'express';
import { GuestSessionsService } from './guest-sessions.service';
import { GUEST_SESSION_COOKIE } from './guest-session.constants';

@Controller('guest-sessions')
export class GuestSessionsController {
  constructor(private readonly guestSessionsService: GuestSessionsService) {}

  /**
   * Параметры cookie гостевой сессии.
   *
   * В продакшене фронт и API лежат на разных доменах, поэтому cookie
   * должна быть cross-site: Secure + SameSite=None.
   * Локально фронт и API на одном хосте (localhost), там достаточно Lax
   * без Secure — иначе браузер не примет cookie по http.
   */
  private getCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'none' | 'lax';
    path: string;
  } {
    const isProduction: boolean = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };
  }

  /**
   * Создаёт гостевую сессию и устанавливает её секрет в HttpOnly cookie.
   *
   * Сам секрет не возвращается в теле ответа.
   */
  @Public()
  @Post()
  /**
   * Лимит считается по устройству (cookie fd_device), а не по адресу:
   * за Cloudflare адрес общий у всех посетителей, и общий счётчик
   * приводил к тому, что вход в гостевой режим упирался в 429.
   */
  @Throttle({
    default: { limit: 20, ttl: 60_000 },
    ip: { limit: 30, ttl: 60_000 },
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ expiresAt: Date | null }> {
    const { guestSession, token } =
      await this.guestSessionsService.createSession();

    response.cookie(GUEST_SESSION_COOKIE, token, {
      ...this.getCookieOptions(),
      maxAge: this.guestSessionsService.getCookieMaxAge(),
    });

    return {
      expiresAt: guestSession.expiresAt,
    };
  }

  /**
   * Возвращает состояние текущей гостевой сессии.
   *
   * Позволяет фронту восстановить гостевой режим после перезагрузки страницы,
   * не создавая новую сессию. Если cookie нет или срок её истёк —
   * возвращается 401.
   */
  @Public()
  @Get()
  async current(@Req() request: Request): Promise<{ expiresAt: Date | null }> {
    const token = this.getCookieValue(
      request.headers.cookie,
      GUEST_SESSION_COOKIE,
    );

    if (!token) {
      throw new UnauthorizedException('Guest session is required');
    }

    const guestSession = await this.guestSessionsService.resolveSession(token);

    return {
      expiresAt: guestSession.expiresAt,
    };
  }

  /**
   * Отзывает текущую гостевую сессию и очищает cookie.
   */
  @Public()
  @Post('revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.getCookieValue(
      request.headers.cookie,
      GUEST_SESSION_COOKIE,
    );

    if (token) {
      await this.guestSessionsService.revokeSession(token);
    }

    response.clearCookie(GUEST_SESSION_COOKIE, this.getCookieOptions());
  }

  private getCookieValue(
    cookieHeader: string | undefined,
    cookieName: string,
  ): string | null {
    if (!cookieHeader) {
      return null;
    }

    for (const cookie of cookieHeader.split(';')) {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const name = cookie.slice(0, separatorIndex).trim();

      if (name !== cookieName) {
        continue;
      }

      try {
        return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
      } catch {
        return null;
      }
    }

    return null;
  }
}
