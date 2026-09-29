import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Product' }) @IsOptional() @IsString()
  entity?: string;

  @ApiPropertyOptional({ example: 'PRODUCT_CREATED' }) @IsOptional() @IsString()
  action?: string;
}
