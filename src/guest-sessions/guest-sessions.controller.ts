import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Public } from '../auth/types/auth.decorators';
import type { Request, Response } from 'express';
import { GuestSessionsService } from './guest-sessions.service';
import { GUEST_SESSION_COOKIE } from './guest-session.constants';

@Controller('guest-sessions')
export class GuestSessionsController {
  constructor(private readonly guestSessionsService: GuestSessionsService) {}

  /**
   * Создаёт гостевую сессию и устанавливает её секрет в HttpOnly cookie.
   *
   * Сам секрет не возвращается в теле ответа.
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ expiresAt: Date | null }> {
    const { guestSession, token } =
      await this.guestSessionsService.createSession();

    response.cookie(GUEST_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'test',
      sameSite: process.env.NODE_ENV === 'test' ? 'lax' : 'none',
      path: '/',
      maxAge: this.guestSessionsService.getCookieMaxAge(),
    });

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

    response.clearCookie(GUEST_SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'test',
      sameSite: process.env.NODE_ENV === 'test' ? 'lax' : 'none',
      path: '/',
    });
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
