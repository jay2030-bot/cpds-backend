import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ApiResult } from '../common/dto/api-result';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (admin only)' })
  async list(@Query() query: QueryAuditLogsDto) {
    const { items, meta } = await this.audit.findAll(query);
    return new ApiResult(items, 'Audit logs', meta);
  }
}
