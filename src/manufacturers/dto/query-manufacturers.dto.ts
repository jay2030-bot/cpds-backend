import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ToBoolean, Trim } from '../../common/dto/transforms';

export class QueryManufacturersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, email or registration number' })
  @IsOptional() @Trim() @IsString()
  search?: string;

  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean()
  isActive?: boolean;
}
