import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { Request } from 'express';
import { AuditLog } from './audit-log.entity';
import { AuditAction, AuditResult } from './audit.enums';
import { AuditLogQueryDto } from './audit-log-query.dto';
import { maskSensitive } from '../logging/request-logging.interceptor';

/**
   * Компонент модуля «audit», отвечающий за специализированную часть логики приложения.
   */
export interface AuditEntry {
  action: AuditAction;
  result?: AuditResult;
  actorId?: number | null;
  actorRole?: string | null;
  entityType?: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
   * Компонент модуля «audit», отвечающий за специализированную часть логики приложения.
   */
export interface AuditPage {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_DETAILS_LENGTH = 4000;

/**
   * Предоставляет операции чтения и сохранения записей аудита.
   */
@Injectable()
export class AuditService {
  private readonly logger: Logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  /**
   * Реализует часть прикладного сценария, инкапсулированного этим компонентом.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const requestUser = (
        entry.request as
          (Request & { user?: { id: number; role: string } }) | undefined
      )?.user;

      await this.repository.save(
        this.repository.create({
          actorId: entry.actorId ?? requestUser?.id ?? null,
          actorRole: entry.actorRole ?? requestUser?.role ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          result: entry.result ?? AuditResult.SUCCESS,
          ip: entry.request?.ip ?? null,
          userAgent:
            entry.request?.headers['user-agent']?.slice(0, 255) ?? null,
          details: this.sanitize(entry.details),
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to write audit log (${entry.action}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Возвращает данные, удовлетворяющие условиям метода; при отсутствии подходящих записей результат определяется контрактом репозитория или сервиса.
   */
  async findPage(query: AuditLogQueryDto): Promise<AuditPage> {
    const where: FindOptionsWhere<AuditLog> = {};

    if (query.actorId !== undefined) where.actorId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId !== undefined) where.entityId = query.entityId;

    if (query.from && query.to) {
      where.createdAt = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(new Date(query.to));
    }

    const page: number = query.page ?? 1;
    const pageSize: number = query.pageSize ?? 20;

    const [items, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total, page, pageSize };
  }

  private sanitize(
    details?: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (!details) {
      return null;
    }

    const masked = maskSensitive(details) as Record<string, unknown>;

    return JSON.stringify(masked).length > MAX_DETAILS_LENGTH
      ? { truncated: true }
      : masked;
  }
}
