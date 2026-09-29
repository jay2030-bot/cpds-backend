import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const valid = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: JwtPayload = { sub: user.id, role: user.role, manufacturerId: user.manufacturerId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, manufacturerId: user.manufacturerId },
    };
  }
}
