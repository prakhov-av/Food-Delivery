import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const normalize = (origin: string): string =>
  origin.trim().replace(/\/+$/, '');

/**
   * Минимальная CSRF-защита для cookie-аутентификации (SameSite=None).
   * Запросы, меняющие состояние, принимаются только с разрешённого Origin.
   * CORS_ORIGINS: адреса фронта через запятую, например
   * http://localhost:5173,https://my-front.ondigitalocean.app
   * CSRF_ALLOW_NO_ORIGIN=true: пропускать запросы без заголовка Origin
   * (Postman, curl, supertest). Только для dev и тестов, в проде не включать.
   */
/**
   * Проверяет защитные признаки запросов, изменяющих состояние, чтобы снизить риск CSRF при cookie-аутентификации.
   */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string> = new Set(
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map(normalize)
      .filter(Boolean),
  );

  private readonly allowNoOrigin: boolean =
    process.env.CSRF_ALLOW_NO_ORIGIN === 'true';

  use(request: Request, _response: Response, next: NextFunction): void {
    // GET, HEAD и OPTIONS не меняют состояние
    if (SAFE_METHODS.includes(request.method)) {
      next();

      return;
    }

    const origin: string | undefined = request.headers.origin;

    if (!origin) {
      if (this.allowNoOrigin) {
        next();

        return;
      }

      throw new ForbiddenException('Origin header is required');
    }

    if (!this.allowedOrigins.has(normalize(origin))) {
      throw new ForbiddenException('Invalid request origin');
    }

    next();
  }
}
