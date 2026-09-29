import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, VerificationResult } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ApiResult } from '../common/dto/api-result';
import { QueryVerificationsDto } from './dto/query-verifications.dto';
import { VerificationService } from './verification.service';

/** Authenticated history views. Manufacturers are scoped to their own products (enforced in the service). */
@ApiTags('Verification History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANUFACTURER)
@Controller('verifications')
export class VerificationLogsController {
  constructor(private readonly service: VerificationService) {}

  @Get()
  @ApiOperation({ summary: 'List verification history, with filters' })
  async list(@Query() query: QueryVerificationsDto, @CurrentUser() user: AuthUser) {
    const { items, meta } = await this.service.findHistory(query, user);
    return new ApiResult(items, 'Verification history retrieved', meta);
  }

  @Get('suspicious')
  @ApiOperation({ summary: 'List only verification attempts flagged as suspicious' })
  async suspicious(@Query() query: QueryVerificationsDto, @CurrentUser() user: AuthUser) {
    const { items, meta } = await this.service.findHistory(query, user, VerificationResult.SUSPICIOUS);
    return new ApiResult(items, 'Suspicious verification activity retrieved', meta);
  }
}
