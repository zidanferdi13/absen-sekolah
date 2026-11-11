import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../../lib/audit.js';

const createSchema = z.object({
  name: z.string().min(1).max(30),
  level: z.string().min(1).max(10),
  academicYearId: z.string().min(1),
});

const updateSchema = createSchema.partial();

export default async function classRoutes(app: FastifyInstance) {
  app.get('/classes', { preHandler: app.authenticate }, async (request, reply) => {
    const { academicYearId } = (request.query ?? {}) as { academicYearId?: string };

    const rows = await app.prisma.classRoom.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        academicYear: { select: { id: true, name: true, isActive: true } },
        _count: { select: { students: { where: { deletedAt: null } } } },
      },
    });

    return reply.send({
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        level: row.level,
        academicYearId: row.academicYearId,
        academicYearName: row.academicYear.name,
        studentCount: row._count.students,
      })),
    });
  });

  app.post(
    '/classes',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const exists = await app.prisma.classRoom.findFirst({
        where: { academicYearId: parsed.data.academicYearId, name: parsed.data.name },
      });
      if (exists) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: 'Kelas dengan nama itu sudah ada di tahun ajaran ini' },
        });
      }

      const created = await app.prisma.classRoom.create({ data: parsed.data });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'class.create',
        entity: 'ClassRoom',
        entityId: created.id,
        after: created,
        ip: request.ip,
      });

      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/classes/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const existing = await app.prisma.classRoom.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Kelas tidak ditemukan' } });
      }

      const updated = await app.prisma.classRoom.update({ where: { id }, data: parsed.data });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'class.update',
        entity: 'ClassRoom',
        entityId: id,
        before: existing,
        after: updated,
        ip: request.ip,
      });

      return reply.send(updated);
    },
  );

  app.delete(
    '/classes/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await app.prisma.classRoom.findUnique({
        where: { id },
        include: { _count: { select: { students: { where: { deletedAt: null } } } } },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Kelas tidak ditemukan' } });
      }

      if (existing._count.students > 0) {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'Kelas masih memiliki siswa aktif, pindahkan dulu siswanya',
          },
        });
      }

      await app.prisma.classRoom.delete({ where: { id } });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'class.delete',
        entity: 'ClassRoom',
        entityId: id,
        before: existing,
        ip: request.ip,
      });

      return reply.status(204).send();
    },
  );
}
