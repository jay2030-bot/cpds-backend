import { ApiProperty } from '@nestjs/swagger';
import { CodeStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCodeStatusDto {
  @ApiProperty({ enum: CodeStatus, example: CodeStatus.DEACTIVATED })
  @IsEnum(CodeStatus)
  status: CodeStatus;
}
