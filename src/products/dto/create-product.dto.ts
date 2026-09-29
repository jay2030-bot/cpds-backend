import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '../../common/dto/transforms';

export class CreateProductDto {
  @ApiPropertyOptional({ description: 'Required for admins; ignored/forbidden for manufacturers (own ID is used)' })
  @IsOptional() @IsUUID()
  manufacturerId?: string;

  @ApiProperty({ example: 'Premium Rice 5kg' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'RICE-5KG', description: 'Unique product code (stored upper-case)' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(50)
  productCode: string;

  @ApiProperty({ example: 'Food' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(80)
  category: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'RICE-2026-001' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(50)
  batchNumber: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(80)
  serialNumber?: string;

  @ApiPropertyOptional({ example: '2026-01-15' }) @IsOptional() @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional({ example: '2027-01-15' }) @IsOptional() @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.ACTIVE }) @IsOptional() @IsEnum(ProductStatus)
  status?: ProductStatus;
}
