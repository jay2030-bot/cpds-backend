import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ManualVerifyDto {
  @ApiProperty({ example: 'CPDS-8F7K-X29P-4LMQ-7TZ1', description: 'Verification code as printed on the product' })
  @IsString() @IsNotEmpty() @MaxLength(64)
  code: string;
}
