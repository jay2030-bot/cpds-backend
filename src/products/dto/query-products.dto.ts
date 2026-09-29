import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Trim } from '../../common/dto/transforms';

export const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'productCode', 'batchNumber', 'expiryDate'] as const;

export class QueryProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches product name, product code or batch number' })
  @IsOptional() @Trim() @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Admins only; manufacturers are always scoped to themselves' })
  @IsOptional() @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional({ enum: ProductStatus }) @IsOptional() @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ enum: PRODUCT_SORT_FIELDS, default: 'createdAt' }) @IsOptional() @IsIn(PRODUCT_SORT_FIELDS)
  sortBy: (typeof PRODUCT_SORT_FIELDS)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' }) @IsOptional() @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
