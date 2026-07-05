import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationSchema } from '@prospect/shared';
import type { Pagination } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { AuditLogService } from './audit-log.service';

@ApiTags('platform/audit-log')
@Controller('platform/audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles('ADMIN')
  list(@CurrentAuth() auth: AuthContext, @Query(new ZodValidationPipe(paginationSchema)) query: Pagination) {
    return this.auditLogService.list(auth.organizationId, query);
  }
}
