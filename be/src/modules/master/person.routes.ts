import type { FastifyInstance } from 'fastify';
import type { PersonType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { parsePagination, metaOf } from '../../lib/pagination.js';
import { writeAuditLog } from '../../lib/audit.js';
import { flattenPerson, normalizeUid, personSelect } from './shared.js';

const createSchema = z.object({
  fullName: z.string().min(2).max(120),
  gender: z.enum(['L', 'P']).optional(),
  phone: z.string().max(30).optional(),
  photoUrl: z.string().url().optional(),
  classId: z.string().optional(),
  nis: z.string().min(1).max(30).optional(),
  nip: z.string().min(1).max(30).optional(),
  rfidUid: z.string().min(4).max(40).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const listQuery = z.object({
  q: z.string().optional(),
  classId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'deleted']).optional(),
});

export async function registerPersonRoutes(app: FastifyInstance, type: PersonType, basePath: string) {
  const idField = type === 'STUDENT' ? 'nis' : 'nip';
  const entity = type === 'STUDENT' ? 'student' : 'teacher';

  app.get(basePath, { preHandler: app.authenticate }, async (request, reply) => {
    const paging = parsePagination(request.query);
    const filter = listQuery.parse(request.query ?? {});

    const where: Prisma.PersonWhereInput = { type };

    if (filter.status === 'deleted') {
      where.deletedAt = { not: null };
    } else if (filter.status === 'inactive') {
      where.deletedAt = null;
      where.isActive = false;
    } else if (filter.status === 'active') {
      where.deletedAt = null;
      where.isActive = true;
    } else {
      where.deletedAt = null;
    }

    if (filter.classId) where.classId = filter.classId;
    if (filter.q) {
      where.OR = [
        { fullName: { contains: filter.q, mode: 'insensitive' } },
        { [idField]: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      app.prisma.person.findMany({
        where,
        select: personSelect(),
        orderBy: { fullName: 'asc' },
        skip: paging.skip,
        take: paging.take,
      }),
      app.prisma.person.count({ where }),
    ]);

    return reply.send({ data: rows.map(flattenPerson), meta: metaOf(total, paging) });
  });

  app.post(
    basePath,
    { preHandler: app.requireRole('OPERATOR', 'ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: parsed.error.issues,
          },
        });
      }

      const body = parsed.data;
      const identifier = type === 'STUDENT' ? body.nis : body.nip;

      if (!identifier) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: type === 'STUDENT' ? 'NIS wajib diisi' : 'NIP wajib diisi',
          },
        });
      }

      const duplicate = await app.prisma.person.findFirst({
        where: { type, [idField]: identifier },
      });
      if (duplicate) {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: type === 'STUDENT' ? 'NIS sudah digunakan' : 'NIP sudah digunakan',
          },
        });
      }

      const uid = body.rfidUid ? normalizeUid(body.rfidUid) : null;
      if (uid) {
        const cardTaken = await app.prisma.rfidCard.findUnique({ where: { uid } });
        if (cardTaken) {
          return reply.status(409).send({
            error: { code: 'CONFLICT', message: 'UID kartu sudah terdaftar' },
          });
        }
      }

      try {
        const created = await app.prisma.$transaction(async (tx) => {
          const person = await tx.person.create({
            data: {
              type,
              fullName: body.fullName,
              gender: body.gender,
              phone: body.phone,
              photoUrl: body.photoUrl,
              classId: type === 'STUDENT' ? (body.classId ?? null) : null,
              nis: type === 'STUDENT' ? identifier : null,
              nip: type === 'TEACHER' ? identifier : null,
            },
          });

          if (uid) {
            await tx.rfidCard.create({
              data: { uid, personId: person.id, status: 'ACTIVE', assignedAt: new Date() },
            });
          }

          return tx.person.findUniqueOrThrow({ where: { id: person.id }, select: personSelect() });
        });

        await writeAuditLog(app.prisma, {
          actorUserId: request.user.sub,
          action: `${entity}.create`,
          entity: 'Person',
          entityId: created.id,
          after: created,
          ip: request.ip,
        });

        return reply.status(201).send(flattenPerson(created));
      } catch (err) {
        if (err instanceof Error && 'code' in err && err.code === 'P2002') {
          return reply.status(409).send({
            error: { code: 'CONFLICT', message: 'Data duplikat' },
          });
        }
        throw err;
      }
    },
  );

  app.get(`${basePath}/:id`, { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const person = await app.prisma.person.findFirst({
      where: { id, type },
      select: personSelect(),
    });

    if (!person) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan' } });
    }
    return reply.send(flattenPerson(person));
  });

  app.patch(
    `${basePath}/:id`,
    { preHandler: app.requireRole('OPERATOR', 'ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const existing = await app.prisma.person.findFirst({ where: { id, type } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan' } });
      }

      const body = parsed.data;
      const identifier = type === 'STUDENT' ? body.nis : body.nip;

      if (identifier && identifier !== existing[idField]) {
        const duplicate = await app.prisma.person.findFirst({
          where: { type, [idField]: identifier, id: { not: id } },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'CONFLICT', message: 'Nomor identitas sudah digunakan' },
          });
        }
      }

      const data: Prisma.PersonUpdateInput = {
        fullName: body.fullName,
        gender: body.gender,
        phone: body.phone,
        photoUrl: body.photoUrl,
        isActive: body.isActive,
      };
      if (type === 'STUDENT' && body.classId !== undefined) {
        data.class = body.classId ? { connect: { id: body.classId } } : { disconnect: true };
      }
      if (body.nis !== undefined) data.nis = body.nis;
      if (body.nip !== undefined) data.nip = body.nip;

      const updated = await app.prisma.person.update({
        where: { id },
        data,
        select: personSelect(),
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: `${entity}.update`,
        entity: 'Person',
        entityId: id,
        before: flattenPerson({ ...existing, class: null, cards: [] }),
        after: flattenPerson(updated),
        ip: request.ip,
      });

      return reply.send(flattenPerson(updated));
    },
  );

  app.delete(
    `${basePath}/:id`,
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.person.findFirst({ where: { id, type } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan' } });
      }

      await app.prisma.$transaction([
        app.prisma.rfidCard.updateMany({
          where: { personId: id, status: 'ACTIVE' },
          data: { status: 'INACTIVE', revokedAt: new Date() },
        }),
        app.prisma.person.update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false },
        }),
      ]);

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: `${entity}.delete`,
        entity: 'Person',
        entityId: id,
        before: existing,
        ip: request.ip,
      });

      return reply.status(204).send();
    },
  );
}
