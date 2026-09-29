import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateManufacturerDto } from './create-manufacturer.dto';

export class UpdateManufacturerDto extends PartialType(OmitType(CreateManufacturerDto, ['adminUser'] as const)) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}
