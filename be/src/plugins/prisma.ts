import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (app) => {
  const prisma = new PrismaClient({
    log: app.log.level === 'debug' ? ['warn', 'error'] : ['error'],
  });

  try {
    await prisma.$connect();
  } catch (err) {
    app.log.error({ err }, 'Gagal terhubung ke database');
    throw err;
  }

  app.decorate('prisma', prisma);
  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
});
