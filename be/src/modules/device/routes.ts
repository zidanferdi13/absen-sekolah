import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../lib/env.js';
import { handleTap } from './tap.service.js';

const tapSchema = z.object({
  uid: z.string().min(4).max(40),
  deviceTs: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1).max(120),
});

const batchSchema = z.object({
  taps: z.array(tapSchema).min(1).max(100),
});

const heartbeatSchema = z.object({
  firmwareVersion: z.string().max(40).optional(),
  ip: z.string().max(60).optional(),
  rssi: z.number().int().optional(),
});

export default async function deviceRoutes(app: FastifyInstance) {
  await app.register(
    async (scope) => {
      scope.addHook('preHandler', scope.deviceAuth);

      scope.post(
        '/tap',
        {
          config: {
            rateLimit: {
              max: env.DEVICE_RATE_LIMIT_PER_MINUTE,
              timeWindow: '1 minute',
              // deviceAuth berjalan di preHandler; rate limit harus setelahnya agar
              // `request.device` sudah terisi saat keyGenerator dipanggil.
              hook: 'preHandler',
              keyGenerator: (request) => request.device?.code ?? request.ip,
            },
          },
        },
        async (request, reply) => {
          const parsed = tapSchema.safeParse(request.body);
          if (!parsed.success) {
            return reply.status(400).send({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Payload tap tidak valid',
                details: parsed.error.issues,
              },
            });
          }

          const result = await handleTap(scope.prisma, {
            deviceId: request.device.id,
            uid: parsed.data.uid,
            deviceTs: parsed.data.deviceTs ? new Date(parsed.data.deviceTs) : null,
            idempotencyKey: parsed.data.idempotencyKey,
            rawPayload: parsed.data,
          });

          return reply.send(result);
        },
      );

      scope.post('/taps/batch', async (request, reply) => {
        const parsed = batchSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Batch tidak valid (maksimal 100 tap)',
              details: parsed.error.issues,
            },
          });
        }

        let accepted = 0;
        let duplicates = 0;
        let rejected = 0;

        for (const item of parsed.data.taps) {
          const key = item.idempotencyKey;
          const exists = await scope.prisma.tapLog.findUnique({ where: { idempotencyKey: key } });
          if (exists) {
            duplicates += 1;
            continue;
          }

          const result = await handleTap(scope.prisma, {
            deviceId: request.device.id,
            uid: item.uid,
            deviceTs: item.deviceTs ? new Date(item.deviceTs) : null,
            idempotencyKey: key,
            rawPayload: item,
          });

          if (result.decision === 'ACCEPTED') accepted += 1;
          else if (result.decision === 'DUPLICATE') duplicates += 1;
          else rejected += 1;
        }

        return reply.send({ accepted, duplicates, rejected });
      });

      scope.post('/heartbeat', async (request, reply) => {
        const parsed = heartbeatSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.status(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Payload heartbeat tidak valid' },
          });
        }

        await scope.prisma.device.update({
          where: { id: request.device.id },
          data: {
            firmwareVersion: parsed.data.firmwareVersion,
            ipAddress: parsed.data.ip,
            lastSeenAt: new Date(),
          },
        });

        return reply.send({ ok: true, serverTime: new Date().toISOString() });
      });

      scope.get('/bootstrap', async (request, reply) => {
        const [schoolName, latestRule] = await Promise.all([
          scope.prisma.setting.findUnique({ where: { key: 'school.name' } }),
          scope.prisma.tapRule.findFirst({ orderBy: { updatedAt: 'desc' } }),
        ]);

        return reply.send({
          schoolName: schoolName?.value ?? 'Sekolah',
          timezone: env.SCHOOL_TIMEZONE,
          serverTime: new Date().toISOString(),
          rulesVersion: (latestRule?.updatedAt ?? new Date(0)).toISOString(),
          heartbeatIntervalSec: 60,
        });
      });
    },
    { prefix: '/device' },
  );
}
