import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  manufacturerId: string | null;
}

/** Shape attached to req.user after JWT validation. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  manufacturerId: string | null;
}
