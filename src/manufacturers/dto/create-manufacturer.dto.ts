import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Trim } from '../../common/dto/transforms';

export class ManufacturerUserDto {
  @ApiProperty({ example: 'Jane Doe' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'jane@abcfoods.com' }) @Trim() @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(72)
  password: string;
}

export class CreateManufacturerDto {
  @ApiProperty({ example: 'ABC Foods Ltd.' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'info@abcfoods.com' }) @Trim() @IsEmail()
  email: string;

  @ApiProperty({ example: '+2348012345678' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(30)
  phone: string;

  @ApiProperty({ example: '12 Industrial Ave, Abuja' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(300)
  address: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(500)
  logo?: string;

  @ApiPropertyOptional({ example: 'RC-123456' }) @IsOptional() @Trim() @IsString() @MaxLength(50)
  registrationNumber?: string;

  @ApiPropertyOptional({ type: ManufacturerUserDto, description: 'Optionally create the manufacturer login in the same step' })
  @IsOptional() @ValidateNested() @Type(() => ManufacturerUserDto)
  adminUser?: ManufacturerUserDto;
}
