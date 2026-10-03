import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, tap } from 'rxjs';

const SENSITIVE_KEYS = [
  'password',
  'newPassword',
  'oldPassword',
  'accessToken',
  'refreshToken',
];

export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        SENSITIVE_KEYS.includes(key) ? '***' : maskSensitive(v),
      ]),
    );
  }

  return value;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger = new Logger(RequestLoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const className: string = context.getClass().name;
    const methodName: string = context.getHandler().name;
    const request: any = context.switchToHttp().getRequest();

    const params: string = JSON.stringify(request.params);
    const body: string = request.body
      ? JSON.stringify(maskSensitive(request.body))
      : 'none';

    // Секретные поля (пароли, токены) маскируются через maskSensitive.
    // Остальное тело по-прежнему логируется целиком.
    this.logger.debug(
      `${className}.${methodName} called with params: ${params} and body: ${body}`,
    );

    const startedAt: number = Date.now();

    return next.handle().pipe(
      tap((): void => {
        this.logger.debug(
          `${className}.${methodName} returned result in ${Date.now() - startedAt} ms`,
        );
      }),
      catchError((error: any): never => {
        this.logger.warn(
          `${className}.${methodName} threw error: ${error.message} in ${Date.now() - startedAt} ms`,
        );
        throw error;
      }),
    );
  }
}
