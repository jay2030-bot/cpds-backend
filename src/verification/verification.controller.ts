import { Body, Controller, Get, Ip, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiResult } from '../common/dto/api-result';
import { ManualVerifyDto } from './dto/manual-verify.dto';
import { VerificationService } from './verification.service';

/**
 * Public, unauthenticated endpoints — this is what a customer's phone hits after
 * scanning a QR code, or what the manual-entry page submits. No JwtAuthGuard here
 * by design. Rate-limited globally via ThrottlerModule (RATE_LIMIT env var).
 */
@ApiTags('Public Verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Verify a product by the token embedded in its QR code' })
  @ApiParam({ name: 'token', example: 'CPDS-8F7K-X29P-4LMQ-7TZ1' })
  async verifyByToken(@Param('token') token: string, @Req() req: Request, @Ip() ip: string) {
    const result = await this.service.verify(token, { ipAddress: ip, userAgent: req.headers['user-agent'] });
    return new ApiResult(result, result.message);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Verify a product by a manually typed-in code' })
  async verifyManual(@Body() dto: ManualVerifyDto, @Req() req: Request, @Ip() ip: string) {
    const result = await this.service.verify(dto.code, { ipAddress: ip, userAgent: req.headers['user-agent'] });
    return new ApiResult(result, result.message);
  }
}
