import type { FastifyInstance } from 'fastify';
import type { CardStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { parsePagination, metaOf } from '../../lib/pagination.js';
import { writeAuditLog } from '../../lib/audit.js';
import { normalizeUid } from './shared.js';

const createSchema = z.object({
  uid: z.string().min(4).max(40),
  label: z.string().max(60).optional(),
  personId: z.string().optional(),
});

const updateSchema = z.object({
  personId: z.string().nullable().optional(),
  label: z.string().max(60).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOST']).optional(),
});

const revokeSchema = z.object({
  status: z.enum(['INACTIVE', 'LOST']).default('INACTIVE'),
});

export default async function cardRoutes(app: FastifyInstance) {
  app.get('/cards', { preHandler: app.authenticate }, async (request, reply) => {
    const paging = parsePagination(request.query);
    const query = (request.query ?? {}) as { status?: string; assigned?: string; q?: string };

    const where: Prisma.RfidCardWhereInput = {};
    if (query.status && ['ACTIVE', 'INACTIVE', 'LOST'].includes(query.status)) {
      where.status = query.status as CardStatus;
    }
    if (query.assigned === 'true') where.personId = { not: null };
    if (query.assigned === 'false') where.personId = null;
    if (query.q) {
      where.OR = [
        { uid: { contains: normalizeUid(query.q) } },
        { label: { contains: query.q, mode: 'insensitive' } },
        { person: { fullName: { contains: query.q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      app.prisma.rfidCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
        include: {
          person: { select: { id: true, fullName: true, nis: true, nip: true, type: true } },
        },
      }),
      app.prisma.rfidCard.count({ where }),
    ]);

    return reply.send({
      data: rows.map((card) => ({
        id: card.id,
        uid: card.uid,
        label: card.label,
        status: card.status,
        person: card.person,
        assignedAt: card.assignedAt,
        revokedAt: card.revokedAt,
      })),
      meta: metaOf(total, paging),
    });
  });

  app.post(
    '/cards',
    { preHandler: app.requireRole('OPERATOR', 'ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const uid = normalizeUid(parsed.data.uid);
      const existing = await app.prisma.rfidCard.findUnique({ where: { uid } });
      if (existing) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: 'UID kartu sudah terdaftar' },
        });
      }

      if (parsed.data.personId) {
        const person = await app.prisma.person.findUnique({ where: { id: parsed.data.personId } });
        if (!person || person.deletedAt) {
          return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pemilik tidak ditemukan' } });
        }
      }

      const created = await app.prisma.rfidCard.create({
        data: {
          uid,
          label: parsed.data.label,
          personId: parsed.data.personId ?? null,
          assignedAt: parsed.data.personId ? new Date() : null,
        },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'card.create',
        entity: 'RfidCard',
        entityId: created.id,
        after: created,
        ip: request.ip,
      });

      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/cards/:id',
    { preHandler: app.requireRole('OPERATOR', 'ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const existing = await app.prisma.rfidCard.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Kartu tidak ditemukan' } });
      }

      const { personId, label, status } = parsed.data;

      if (personId) {
        const person = await app.prisma.person.findUnique({ where: { id: personId } });
        if (!person || person.deletedAt) {
          return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pemilik tidak ditemukan' } });
        }
      }

      const updated = await app.prisma.$transaction(async (tx) => {
        if (personId) {
          await tx.rfidCard.updateMany({
            where: { personId, status: 'ACTIVE', id: { not: id } },
            data: { status: 'INACTIVE', revokedAt: new Date() },
          });
        }

        return tx.rfidCard.update({
          where: { id },
          data: {
            label,
            status,
            personId: personId === undefined ? undefined : personId,
            assignedAt: personId ? new Date() : personId === null ? null : undefined,
            revokedAt: status && status !== 'ACTIVE' ? new Date() : undefined,
          },
        });
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'card.update',
        entity: 'RfidCard',
        entityId: id,
        before: existing,
        after: updated,
        ip: request.ip,
      });

      return reply.send(updated);
    },
  );

  app.post(
    '/cards/:id/revoke',
    { preHandler: app.requireRole('OPERATOR', 'ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = revokeSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Status tidak valid' },
        });
      }

      const existing = await app.prisma.rfidCard.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Kartu tidak ditemukan' } });
      }

      const updated = await app.prisma.rfidCard.update({
        where: { id },
        data: { status: parsed.data.status, revokedAt: new Date() },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'card.revoke',
        entity: 'RfidCard',
        entityId: id,
        before: existing,
        after: updated,
        ip: request.ip,
      });

      return reply.send(updated);
    },
  );
}
