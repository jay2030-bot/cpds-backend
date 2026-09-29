import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [VerificationModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
