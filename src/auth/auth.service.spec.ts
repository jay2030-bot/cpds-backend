import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const hash = bcrypt.hashSync('Secret@123', 4);
  const baseUser = { id: 'u1', name: 'A', email: 'a@x.com', password: hash, role: 'ADMIN', manufacturerId: null, isActive: true };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt') } as unknown as JwtService;
  const build = (user: unknown) => new AuthService({ findByEmail: jest.fn().mockResolvedValue(user) } as any, jwt);

  it('returns a token and no password for valid credentials', async () => {
    const res = await build(baseUser).login({ email: 'a@x.com', password: 'Secret@123' });
    expect(res.accessToken).toBe('signed.jwt');
    expect(res.user).not.toHaveProperty('password');
  });

  it('rejects a wrong password', async () => {
    await expect(build(baseUser).login({ email: 'a@x.com', password: 'nope' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email', async () => {
    await expect(build(null).login({ email: 'z@x.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive user', async () => {
    await expect(build({ ...baseUser, isActive: false }).login({ email: 'a@x.com', password: 'Secret@123' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
