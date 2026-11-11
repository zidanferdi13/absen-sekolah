import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../../lib/audit.js';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  name: z.string().min(2).max(120),
  isSchoolDay: z.boolean().optional(),
});

export default async function holidayRoutes(app: FastifyInstance) {
  app.get('/holidays', { preHandler: app.authenticate }, async (request, reply) => {
    const { year } = (request.query ?? {}) as { year?: string };

    const yearNumber = year ? Number(year) : new Date().getFullYear();
    if (!Number.isInteger(yearNumber)) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Tahun tidak valid' },
      });
    }

    const rows = await app.prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(yearNumber, 0, 1)),
          lte: new Date(Date.UTC(yearNumber, 11, 31)),
        },
      },
      orderBy: { date: 'asc' },
    });

    return reply.send({ data: rows });
  });

  app.post(
    '/holidays',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Tanggal tidak valid' } });
      }

      const exists = await app.prisma.holiday.findUnique({ where: { date } });
      if (exists) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: 'Tanggal tersebut sudah terdaftar' },
        });
      }

      const created = await app.prisma.holiday.create({
        data: {
          date,
          name: parsed.data.name,
          isSchoolDay: parsed.data.isSchoolDay ?? false,
        },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'holiday.create',
        entity: 'Holiday',
        entityId: created.id,
        after: created,
        ip: request.ip,
      });

      return reply.status(201).send(created);
    },
  );

  app.delete(
    '/holidays/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.holiday.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Hari libur tidak ditemukan' } });
      }

      await app.prisma.holiday.delete({ where: { id } });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'holiday.delete',
        entity: 'Holiday',
        entityId: id,
        before: existing,
        ip: request.ip,
      });

      return reply.status(204).send();
    },
  );
}
