import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationLogsController } from './verification-logs.controller';
import { VerificationService } from './verification.service';

@Module({
  controllers: [VerificationController, VerificationLogsController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
