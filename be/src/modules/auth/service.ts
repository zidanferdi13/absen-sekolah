import bcrypt from 'bcryptjs';
import type { PrismaClient, Role, User } from '@prisma/client';
import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  type AuthPayload,
} from '../../plugins/auth.js';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function login(prisma: PrismaClient, email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
  }
  if (!user.isActive) {
    throw new AuthError(403, 'ACCOUNT_DISABLED', 'Akun dinonaktifkan');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return toPublicUser(user);
}

export function issueTokens(app: FastifyInstance, user: PublicUser) {
  const payload: AuthPayload = { sub: user.id, email: user.email, role: user.role };
  return {
    access: app.jwt.access.sign(payload, { expiresIn: ACCESS_TTL_SECONDS }),
    refresh: app.jwt.refresh.sign(payload, { expiresIn: REFRESH_TTL_SECONDS }),
  };
}

export async function verifyRefresh(
  app: FastifyInstance,
  token: string,
): Promise<PublicUser> {
  let payload: AuthPayload;
  try {
    payload = app.jwt.refresh.verify<AuthPayload>(token);
  } catch {
    throw new AuthError(401, 'INVALID_REFRESH', 'Refresh token tidak valid');
  }

  const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new AuthError(401, 'INVALID_REFRESH', 'Akun tidak ditemukan atau nonaktif');
  }

  return toPublicUser(user);
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { access: string; refresh: string },
  secure: boolean,
) {
  reply.setCookie(ACCESS_COOKIE, tokens.access, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });

  reply.setCookie(REFRESH_COOKIE, tokens.refresh, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}
