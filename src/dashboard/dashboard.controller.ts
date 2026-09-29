import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ApiResult } from '../common/dto/api-result';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'System-wide statistics, activity chart, top products and recent suspicious activity' })
  async admin(@CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.getDashboard(user), 'Admin dashboard retrieved');
  }

  @Get('manufacturer')
  @Roles(Role.MANUFACTURER)
  @ApiOperation({ summary: "The same statistics, scoped to the caller's own manufacturer" })
  async manufacturer(@CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.getDashboard(user), 'Manufacturer dashboard retrieved');
  }
}
