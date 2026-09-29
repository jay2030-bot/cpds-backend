import { ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel, VerificationResult } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryVerificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VerificationResult }) @IsOptional() @IsEnum(VerificationResult)
  result?: VerificationResult;

  @ApiPropertyOptional({ enum: RiskLevel }) @IsOptional() @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({ description: 'Admins only; manufacturers are always scoped to their own products' })
  @IsOptional() @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @IsDateString()
  to?: string;
}
