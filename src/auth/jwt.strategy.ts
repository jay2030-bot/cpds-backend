import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Re-checks the DB on every request so deactivated users lose access immediately. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Account is unavailable');
    return { id: user.id, name: user.name, email: user.email, role: user.role, manufacturerId: user.manufacturerId };
  }
}
