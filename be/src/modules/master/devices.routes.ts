import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { writeAuditLog } from '../../lib/audit.js';

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh huruf, angka, underscore, dan strip'),
  name: z.string().min(2).max(80),
  location: z.string().max(120).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  location: z.string().max(120).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'MAINTENANCE']).optional(),
});

const generateKey = () => `dev_${randomBytes(24).toString('hex')}`;

export default async function deviceRoutes(app: FastifyInstance) {
  app.get(
    '/devices',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { status } = (request.query ?? {}) as { status?: string };

      const rows = await app.prisma.device.findMany({
        where: status ? { status: status as never } : undefined,
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          location: true,
          status: true,
          firmwareVersion: true,
          ipAddress: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

      return reply.send({ data: rows });
    },
  );

  app.post(
    '/devices',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const exists = await app.prisma.device.findUnique({ where: { code: parsed.data.code } });
      if (exists) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: 'Kode device sudah digunakan' },
        });
      }

      const apiKey = generateKey();
      const created = await app.prisma.device.create({
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          location: parsed.data.location,
          apiKeyHash: await bcrypt.hash(apiKey, 10),
        },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'device.create',
        entity: 'Device',
        entityId: created.id,
        after: { id: created.id, code: created.code, name: created.name },
        ip: request.ip,
      });

      return reply.status(201).send({
        id: created.id,
        code: created.code,
        name: created.name,
        apiKey,
        note: 'Simpan apiKey sekarang, tidak akan ditampilkan lagi',
      });
    },
  );

  app.patch(
    '/devices/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const existing = await app.prisma.device.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Device tidak ditemukan' } });
      }

      const updated = await app.prisma.device.update({
        where: { id },
        data: parsed.data,
        select: { id: true, code: true, name: true, location: true, status: true },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'device.update',
        entity: 'Device',
        entityId: id,
        before: { name: existing.name, location: existing.location, status: existing.status },
        after: updated,
        ip: request.ip,
      });

      return reply.send(updated);
    },
  );

  app.post(
    '/devices/:id/rotate-key',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.device.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Device tidak ditemukan' } });
      }

      const apiKey = generateKey();
      await app.prisma.device.update({
        where: { id },
        data: { apiKeyHash: await bcrypt.hash(apiKey, 10) },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'device.rotate-key',
        entity: 'Device',
        entityId: id,
        ip: request.ip,
      });

      return reply.send({
        id,
        code: existing.code,
        apiKey,
        note: 'Simpan apiKey sekarang, tidak akan ditampilkan lagi',
      });
    },
  );
}
