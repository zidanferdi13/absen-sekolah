import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../../lib/audit.js';

const createSchema = z.object({
  name: z.string().min(4).max(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isActive: z.boolean().optional(),
});

export default async function academicYearRoutes(app: FastifyInstance) {
  app.get('/academic-years', { preHandler: app.authenticate }, async (_request, reply) => {
    const rows = await app.prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { classes: true } } },
    });

    return reply.send({
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        isActive: row.isActive,
        classCount: row._count.classes,
      })),
    });
  });

  app.post(
    '/academic-years',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const { name, startDate, endDate, isActive } = parsed.data;
      if (startDate >= endDate) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Tanggal selesai harus setelah tanggal mulai' },
        });
      }

      const exists = await app.prisma.academicYear.findUnique({ where: { name } });
      if (exists) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: 'Tahun ajaran dengan nama itu sudah ada' },
        });
      }

      const created = await app.prisma.$transaction(async (tx) => {
        if (isActive) {
          await tx.academicYear.updateMany({ data: { isActive: false } });
        }
        return tx.academicYear.create({
          data: {
            name,
            startDate: new Date(`${startDate}T00:00:00.000Z`),
            endDate: new Date(`${endDate}T00:00:00.000Z`),
            isActive: isActive ?? false,
          },
        });
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'academicYear.create',
        entity: 'AcademicYear',
        entityId: created.id,
        after: created,
        ip: request.ip,
      });

      return reply.status(201).send(created);
    },
  );
}
