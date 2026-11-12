import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { env } from '../lib/env.js';

export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}

export const ACCESS_COOKIE = 'access';
export const REFRESH_COOKIE = 'refresh';

export function parseTtlSeconds(value: string, fallbackSeconds: number): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const factor = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : 1;
  return amount * factor;
}

export const ACCESS_TTL_SECONDS = parseTtlSeconds(env.ACCESS_TOKEN_TTL, 15 * 60);
export const REFRESH_TTL_SECONDS = parseTtlSeconds(env.REFRESH_TOKEN_TTL, 7 * 86400);

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: Role[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthPayload;
    user: AuthPayload;
  }

  // Plugin ini meregistrasi @fastify/jwt dua kali, dengan namespace `access` dan
  // `refresh`. Saat namespace dipakai, setiap namespace menjadi instance JWT
  // tersendiri di `app.jwt`, jadi tipenya perlu dideklarasikan eksplisit.
  interface JWT {
    access: Pick<JWT, 'sign' | 'verify' | 'decode'>;
    refresh: Pick<JWT, 'sign' | 'verify' | 'decode'>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, { namespace: 'access', secret: env.JWT_ACCESS_SECRET });
  await app.register(jwt, { namespace: 'refresh', secret: env.JWT_REFRESH_SECRET });

  const unauthorized = (reply: FastifyReply) =>
    reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid, silakan login ulang' },
    });

  const resolveUser = (request: FastifyRequest): AuthPayload | null => {
    const token = request.cookies[ACCESS_COOKIE];
    if (!token) return null;
    try {
      return app.jwt.access.verify<AuthPayload>(token);
    } catch {
      return null;
    }
  };

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = resolveUser(request);
    if (!payload) {
      await unauthorized(reply);
      return;
    }
    request.user = payload;
  });

  app.decorate('requireRole', (...roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const payload = resolveUser(request);
      if (!payload) {
        await unauthorized(reply);
        return;
      }
      request.user = payload;

      if (!roles.includes(payload.role)) {
        await reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Anda tidak memiliki hak akses untuk aksi ini' },
        });
      }
    };
  });
});
