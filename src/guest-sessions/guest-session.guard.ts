import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GuestSessionsService } from './guest-sessions.service';
import { GUEST_SESSION_COOKIE } from './guest-session.constants';
import { GuestSessionRequest } from './guest-session.request';

/**
 * Проверяет гостевую cookie и помещает действующую сессию в request.
 *
 * Guard предназначен для маршрутов, доступных гостям.
 */
@Injectable()
export class GuestSessionGuard implements CanActivate {
  constructor(private readonly guestSessionsService: GuestSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestSessionRequest>();

    const token = this.getCookieValue(
      request.headers.cookie,
      GUEST_SESSION_COOKIE,
    );

    if (!token) {
      throw new UnauthorizedException('Guest session is required');
    }

    request.guestSession =
      await this.guestSessionsService.resolveSession(token);

    return true;
  }

  /**
   * Извлекает значение cookie из заголовка Cookie.
   */
  private getCookieValue(
    cookieHeader: string | undefined,
    cookieName: string,
  ): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';');

    for (const cookie of cookies) {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const name = cookie.slice(0, separatorIndex).trim();

      if (name !== cookieName) {
        continue;
      }

      const value = cookie.slice(separatorIndex + 1).trim();

      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }

    return null;
  }
}
