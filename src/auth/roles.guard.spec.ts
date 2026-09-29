import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './guards';

const ctxFor = (user: unknown) => ({
  getHandler: () => null, getClass: () => null,
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
}) as any;

describe('RolesGuard', () => {
  const guardWith = (roles: string[] | undefined) =>
    new RolesGuard({ getAllAndOverride: () => roles } as unknown as Reflector);

  it('allows a matching role', () => {
    expect(guardWith(['ADMIN']).canActivate(ctxFor({ role: 'ADMIN' }))).toBe(true);
  });
  it('blocks a manufacturer from admin-only routes', () => {
    expect(() => guardWith(['ADMIN']).canActivate(ctxFor({ role: 'MANUFACTURER' }))).toThrow(ForbiddenException);
  });
  it('allows any authenticated user when no roles are required', () => {
    expect(guardWith(undefined).canActivate(ctxFor({ role: 'MANUFACTURER' }))).toBe(true);
  });
});
