import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';

/**
   * Masks common secret fields in structured audit details.
   * Request bodies and headers must not be logged, even after masking.
   */
const SENSITIVE_KEY_PATTERN =
  /password|passwd|token|secret|api[-_]?key|authorization|cookie|credential|confirmation.?code|email|phone|address/i;

export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '***' : maskSensitive(nested),
      ]),
    );
  }

  return value;
}

/**
   * Регистрирует сведения о входящих HTTP-запросах и результатах их обработки.
   */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const route = request.route?.path;
    const routeName = typeof route === 'string' ? route : 'unmatched';
    const startedAt = Date.now();

    // Do not log request body, query string, route parameters, headers or cookies:
    // they can contain credentials, tokens, or personal information.
    this.logger.debug(
      `HTTP request started: method=${request.method ?? 'unknown'}, route=${routeName}, handler=${className}.${methodName}`,
    );

    return next.handle().pipe(
      tap((): void => {
        this.logger.debug(
          `HTTP request completed: method=${request.method ?? 'unknown'}, route=${routeName}, handler=${className}.${methodName}, status=${response.statusCode ?? 'unknown'}, durationMs=${Date.now() - startedAt}`,
        );
      }),
      catchError((error: unknown) => {
        const status =
          typeof error === 'object' &&
          error !== null &&
          'getStatus' in error &&
          typeof error.getStatus === 'function'
            ? error.getStatus()
            : 500;
        const level = status >= 500 ? 'error' : 'warn';
        const message = `HTTP request failed: method=${request.method ?? 'unknown'}, route=${routeName}, handler=${className}.${methodName}, status=${status}, durationMs=${Date.now() - startedAt}`;

        if (level === 'error') {
          this.logger.error(message);
        } else {
          this.logger.warn(message);
        }

        return throwError(() => error);
      }),
    );
  }
}
