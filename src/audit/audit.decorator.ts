import { SetMetadata } from '@nestjs/common';
import { AuditAction } from './audit.enums';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: AuditAction;
  entityType?: string;
  includeBody?: boolean;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
