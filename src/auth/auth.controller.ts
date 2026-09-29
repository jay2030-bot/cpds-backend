import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiResult } from '../common/dto/api-result';
import { AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards';

const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT ?? 10);

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return new ApiResult(await this.auth.login(dto), 'Login successful');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return new ApiResult(user, 'Current user');
  }
}
