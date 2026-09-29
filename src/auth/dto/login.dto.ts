import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@cpds.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@123456' })
  @IsString() @MinLength(1)
  password: string;
}
