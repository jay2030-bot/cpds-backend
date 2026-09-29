import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class BulkGenerateDto {
  @ApiProperty({ example: 100, minimum: 1, maximum: 1000, description: 'Number of new verification codes to generate for this product' })
  @IsInt() @Min(1) @Max(1000)
  quantity: number;
}
