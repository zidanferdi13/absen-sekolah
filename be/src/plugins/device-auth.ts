import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import type { Device } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    deviceAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    device: Device;
  }
}

export default fp(async (app) => {
  app.decorate('deviceAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const code = request.headers['x-device-code'];
    const key = request.headers['x-device-key'];

    if (typeof code !== 'string' || typeof key !== 'string' || !code || !key) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Header device tidak lengkap' },
      });
    }

    const device = await app.prisma.device.findUnique({ where: { code } });

    if (!device || device.status !== 'ACTIVE') {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Device tidak dikenal atau tidak aktif' },
      });
    }

    const valid = await bcrypt.compare(key, device.apiKeyHash);
    if (!valid) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Device key salah' },
      });
    }

    request.device = device;

    await app.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
  });
});
