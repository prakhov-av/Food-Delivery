import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  use(request: Request, _response: Response, next: NextFunction): void {
    // GET/HEAD/OPTIONS не изменяют состояние
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    const origin = request.headers.origin;

    if (!origin || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Invalid request origin');
    }

    next();
  }
}
