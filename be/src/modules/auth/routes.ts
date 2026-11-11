import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../lib/env.js';
import {
  AuthError,
  clearAuthCookies,
  issueTokens,
  login,
  setAuthCookies,
  verifyRefresh,
} from './service.js';
import { REFRESH_COOKIE } from '../../plugins/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Email atau password tidak valid' },
      });
    }

    try {
      const user = await login(app.prisma, parsed.data.email, parsed.data.password);
      const tokens = issueTokens(app, user);
      setAuthCookies(reply, tokens, env.NODE_ENV === 'production');
      return reply.send({ user });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.post('/refresh', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Refresh token tidak ada' },
      });
    }

    try {
      const user = await verifyRefresh(app, token);
      const tokens = issueTokens(app, user);
      setAuthCookies(reply, tokens, env.NODE_ENV === 'production');
      return reply.send({ user });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.post('/logout', async (_request, reply) => {
    clearAuthCookies(reply);
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: app.authenticate }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user || !user.isActive) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Akun tidak ditemukan' },
      });
    }
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });
}
