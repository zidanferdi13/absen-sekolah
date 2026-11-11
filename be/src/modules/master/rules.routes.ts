import type { FastifyInstance } from 'fastify';
import type { PrayerSlot, RuleScope, TapType } from '@prisma/client';
import { z } from 'zod';
import { writeAuditLog } from '../../lib/audit.js';
import { classify, toLocalParts, type RuleLike } from '../device/classify.js';
import { SCHOOL_TZ } from '../../lib/time.js';
import { loadSchoolConfig } from '../attendance/recompute.js';

const ruleSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'PRAYER', 'OTHER']),
  prayerSlot: z.enum(['DHUHA', 'DHUHUR', 'ASHAR']).nullable().optional(),
  scope: z.enum(['GLOBAL', 'CLASS', 'PERSON']).default('GLOBAL'),
  classId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  minGapMinutes: z.number().int().min(0).max(120).default(2),
  priority: z.number().int().min(0).max(100).default(0),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().default(true),
});

const previewSchema = z.object({
  uid: z.string().min(4),
  at: z.string().datetime(),
});

function validateWindow(
  data: { startMinute: number; endMinute: number; type: TapType; prayerSlot?: PrayerSlot | null; scope: RuleScope; classId?: string | null; personId?: string | null },
): string | null {
  if (data.startMinute >= data.endMinute) {
    return 'Jam mulai harus lebih awal dari jam selesai';
  }
  if (data.type === 'PRAYER' && !data.prayerSlot) {
    return 'Tap sholat wajib memilih slot (DHUHA/DHUHUR/ASHAR)';
  }
  if (data.type !== 'PRAYER' && data.prayerSlot) {
    return 'Slot sholat hanya untuk tipe PRAYER';
  }
  if (data.scope === 'CLASS' && !data.classId) {
    return 'Scope CLASS wajib memilih kelas';
  }
  if (data.scope === 'PERSON' && !data.personId) {
    return 'Scope PERSON wajib memilih orang';
  }
  return null;
}

const toDate = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00.000Z`) : value === null ? null : undefined;

export default async function ruleRoutes(app: FastifyInstance) {
  app.get('/rules', { preHandler: app.authenticate }, async (_request, reply) => {
    const rows = await app.prisma.tapRule.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { startMinute: 'asc' }],
      include: {
        class: { select: { id: true, name: true } },
        person: { select: { id: true, fullName: true } },
      },
    });

    return reply.send({
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        prayerSlot: row.prayerSlot,
        scope: row.scope,
        classId: row.classId,
        className: row.class?.name ?? null,
        personId: row.personId,
        personName: row.person?.fullName ?? null,
        daysOfWeek: row.daysOfWeek,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        minGapMinutes: row.minGapMinutes,
        priority: row.priority,
        validFrom: row.validFrom,
        validTo: row.validTo,
        isActive: row.isActive,
      })),
    });
  });

  app.post(
    '/rules/preview',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const parsed = previewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const card = await app.prisma.rfidCard.findUnique({
        where: { uid: parsed.data.uid.trim().toUpperCase() },
        include: { person: true },
      });

      const at = new Date(parsed.data.at);
      const local = toLocalParts(at, SCHOOL_TZ);

      const [rules, config] = await Promise.all([
        app.prisma.tapRule.findMany({ where: { isActive: true } }),
        loadSchoolConfig(app.prisma),
      ]);

      const ruleLikes: RuleLike[] = rules.map((rule) => ({
        id: rule.id,
        type: rule.type,
        prayerSlot: rule.prayerSlot,
        scope: rule.scope,
        classId: rule.classId,
        personId: rule.personId,
        daysOfWeek: rule.daysOfWeek,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
        minGapMinutes: rule.minGapMinutes,
        priority: rule.priority,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        isActive: rule.isActive,
      }));

      const person =
        card && card.status === 'ACTIVE' && card.person && card.person.deletedAt === null
          ? card.person
          : null;

      const result = classify({
        tappedAt: at,
        local,
        subject: person ? { id: person.id, classId: person.classId } : null,
        rules: ruleLikes,
        lastAcceptedTapAt: null,
      });

      const matched = result.ruleId ? rules.find((rule) => rule.id === result.ruleId) : null;

      return reply.send({
        person: person ? { id: person.id, name: person.fullName, className: null } : null,
        local,
        schoolStartMinute: config.startMinute,
        graceMinutes: config.graceMinutes,
        decision: result.decision,
        tapType: result.tapType,
        prayerSlot: result.prayerSlot,
        reason: result.reason,
        matchedRule: matched ? { id: matched.id, name: matched.name, scope: matched.scope } : null,
      });
    },
  );

  app.post(
    '/rules',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = ruleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const windowError = validateWindow(parsed.data);
      if (windowError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: windowError },
        });
      }

      const created = await app.prisma.tapRule.create({
        data: {
          ...parsed.data,
          prayerSlot: parsed.data.prayerSlot ?? null,
          classId: parsed.data.scope === 'CLASS' ? (parsed.data.classId ?? null) : null,
          personId: parsed.data.scope === 'PERSON' ? (parsed.data.personId ?? null) : null,
          validFrom: toDate(parsed.data.validFrom) ?? null,
          validTo: toDate(parsed.data.validTo) ?? null,
        },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'rule.create',
        entity: 'TapRule',
        entityId: created.id,
        after: created,
        ip: request.ip,
      });

      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/rules/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = ruleSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const existing = await app.prisma.tapRule.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Aturan tidak ditemukan' } });
      }

      const windowError = validateWindow({
        startMinute: parsed.data.startMinute ?? existing.startMinute,
        endMinute: parsed.data.endMinute ?? existing.endMinute,
        type: parsed.data.type ?? existing.type,
        prayerSlot: parsed.data.prayerSlot ?? existing.prayerSlot,
        scope: parsed.data.scope ?? existing.scope,
        classId: parsed.data.classId ?? existing.classId,
        personId: parsed.data.personId ?? existing.personId,
      });
      if (windowError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: windowError },
        });
      }

      const updated = await app.prisma.tapRule.update({
        where: { id },
        data: {
          ...parsed.data,
          validFrom: toDate(parsed.data.validFrom),
          validTo: toDate(parsed.data.validTo),
        },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'rule.update',
        entity: 'TapRule',
        entityId: id,
        before: existing,
        after: updated,
        ip: request.ip,
      });

      return reply.send(updated);
    },
  );

  app.delete(
    '/rules/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.tapRule.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Aturan tidak ditemukan' } });
      }

      await app.prisma.tapRule.delete({ where: { id } });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'rule.delete',
        entity: 'TapRule',
        entityId: id,
        before: existing,
        ip: request.ip,
      });

      return reply.status(204).send();
    },
  );
}
