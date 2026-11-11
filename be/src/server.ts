import Fastify from 'fastify';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './lib/env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import deviceAuthPlugin from './plugins/device-auth.js';
import authRoutes from './modules/auth/routes.js';
import deviceRoutes from './modules/device/routes.js';
import attendanceRoutes from './modules/attendance/routes.js';
import logRoutes from './modules/logs/routes.js';
import classRoutes from './modules/master/classes.routes.js';
import academicYearRoutes from './modules/master/academic-years.routes.js';
import cardRoutes from './modules/master/cards.routes.js';
import deviceMasterRoutes from './modules/master/devices.routes.js';
import holidayRoutes from './modules/master/holidays.routes.js';
import ruleRoutes from './modules/master/rules.routes.js';
import settingsRoutes from './modules/master/settings.routes.js';
import { registerPersonRoutes } from './modules/master/person.routes.js';

function errorHandler(
  rawError: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const error = rawError as FastifyError;
  request.log.error({ err: error }, 'request failed');

  if (error.validation) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    });
  }

  const status = error.statusCode ?? 500;
  return reply.status(status).send({
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: status >= 500 ? 'Terjadi kesalahan pada server' : error.message,
    },
  });
}

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(deviceAuthPlugin);

  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }));

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(deviceRoutes);
      await api.register(attendanceRoutes);
      await api.register(logRoutes);
      await api.register(classRoutes);
      await api.register(academicYearRoutes);
      await api.register(cardRoutes);
      await api.register(deviceMasterRoutes);
      await api.register(holidayRoutes);
      await api.register(ruleRoutes);
      await api.register(settingsRoutes);
      await api.register(async (people) => {
        await registerPersonRoutes(people, 'STUDENT', '/students');
        await registerPersonRoutes(people, 'TEACHER', '/teachers');
      });
    },
    { prefix: '/api/v1' },
  );

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  void main();
}
