import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, from, map, mergeMap, Observable, throwError } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { AuditResult } from './audit.enums';

/**
   * Перехватывает выполнение запросов и записывает результат операции в аудит, включая неуспешное завершение.
   */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta: AuditMeta | undefined = this.reflector.get<
      AuditMeta | undefined
    >(AUDIT_KEY, context.getHandler());

    if (!meta) {
      return next.handle();
    }

    const request: Request = context.switchToHttp().getRequest<Request>();
    const params = request.params;
    const paramId: number = Number(params.id);

    const details: Record<string, unknown> =
      meta.includeBody === false
        ? { method: request.method, params }
        : { method: request.method, params, body: request.body };

    return next.handle().pipe(
      mergeMap((result: unknown) =>
        from(
          this.audit.record({
            action: meta.action,
            entityType: meta.entityType,
            entityId: Number.isInteger(paramId)
              ? paramId
              : this.idFromResult(result),
            details,
            request,
          }),
        ).pipe(map(() => result)),
      ),
      catchError((error: unknown) =>
        from(
          this.audit.record({
            action: meta.action,
            entityType: meta.entityType,
            entityId: Number.isInteger(paramId) ? paramId : null,
            result:
              error instanceof ForbiddenException
                ? AuditResult.DENIED
                : AuditResult.FAILED,
            details: {
              ...details,
              error: error instanceof Error ? error.message : String(error),
            },
            request,
          }),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }

  private idFromResult(result: unknown): number | null {
    if (typeof result === 'object' && result !== null && 'id' in result) {
      const id: unknown = (result as { id: unknown }).id;

      return typeof id === 'number' ? id : null;
    }

    return null;
  }
}
