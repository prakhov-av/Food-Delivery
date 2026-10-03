import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/types/auth.decorators';
import { Role } from '../users/enums/role.enum';
import { AuditService, AuditPage } from './audit.service';
import { AuditLogQueryDto } from './audit-log-query.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  async getPage(@Query() query: AuditLogQueryDto): Promise<AuditPage> {
    return this.service.findPage(query);
  }
}
