import type { FastifyInstance } from 'fastify';
import type { Prisma, TapDecision, TapType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { parsePagination, metaOf } from '../../lib/pagination.js';
import { writeAuditLog } from '../../lib/audit.js';
import { recomputeRange } from '../attendance/recompute.js';
import { SCHOOL_TZ, toDateKey, toDateOnly } from '../../lib/time.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXPORT_DAYS = 366;

const TAP_TYPES: TapType[] = ['CLOCK_IN', 'CLOCK_OUT', 'PRAYER', 'OTHER'];
const DECISIONS: TapDecision[] = ['ACCEPTED', 'DUPLICATE', 'REJECTED', 'UNKNOWN_CARD'];

const filterSchema = z.object({
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  personId: z.string().optional(),
  classId: z.string().optional(),
  tapType: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'PRAYER', 'OTHER']).optional(),
  decision: z.enum(['ACCEPTED', 'DUPLICATE', 'REJECTED', 'UNKNOWN_CARD']).optional(),
  q: z.string().max(120).optional(),
});

const patchSchema = z.object({
  tapType: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'PRAYER', 'OTHER']).optional(),
  prayerSlot: z.enum(['DHUHA', 'DHUHUR', 'ASHAR']).nullable().optional(),
  reason: z.string().min(3).max(200),
});

function buildWhere(filter: z.infer<typeof filterSchema>): Prisma.TapLogWhereInput {
  const where: Prisma.TapLogWhereInput = {};

  if (filter.from || filter.to) {
    where.tappedAt = {};
    if (filter.from) where.tappedAt.gte = toDateOnly(new Date(`${filter.from}T00:00:00.000Z`));
    if (filter.to) {
      where.tappedAt.lte = new Date(`${filter.to}T23:59:59.999Z`);
    }
  }

  if (filter.personId) where.personId = filter.personId;
  if (filter.tapType) where.tapType = filter.tapType;
  if (filter.decision) where.decision = filter.decision;

  if (filter.classId) {
    where.person = { classId: filter.classId };
  }

  if (filter.q) {
    where.OR = [
      { uid: { contains: filter.q.toUpperCase() } },
      { person: { fullName: { contains: filter.q, mode: 'insensitive' } } },
      { person: { nis: { contains: filter.q, mode: 'insensitive' } } },
      { person: { nip: { contains: filter.q, mode: 'insensitive' } } },
    ];
  }

  return where;
}

function assertExportRange(from?: string, to?: string): string | null {
  if (!from || !to) return null;
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days > MAX_EXPORT_DAYS) {
    return `Rentang export maksimum ${MAX_EXPORT_DAYS} hari, diminta ${days} hari`;
  }
  return null;
}

const logInclude = {
  person: {
    select: {
      fullName: true,
      nis: true,
      nip: true,
      class: { select: { name: true } },
    },
  },
  device: { select: { code: true, name: true } },
} satisfies Prisma.TapLogInclude;

export default async function logRoutes(app: FastifyInstance) {
  app.get('/logs', { preHandler: app.authenticate }, async (request, reply) => {
    const paging = parsePagination(request.query);
    const parsed = filterSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Filter tidak valid', details: parsed.error.issues },
      });
    }

    const where = buildWhere(parsed.data);

    const [rows, total] = await Promise.all([
      app.prisma.tapLog.findMany({
        where,
        include: logInclude,
        orderBy: { tappedAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
      }),
      app.prisma.tapLog.count({ where }),
    ]);

    return reply.send({
      data: rows.map((row) => ({
        id: row.id,
        uid: row.uid,
        person: row.person
          ? {
              name: row.person.fullName,
              nis: row.person.nis,
              nip: row.person.nip,
              className: row.person.class?.name ?? null,
            }
          : null,
        device: { code: row.device.code, name: row.device.name },
        tappedAt: row.tappedAt,
        tapType: row.tapType,
        prayerSlot: row.prayerSlot,
        decision: row.decision,
        reason: row.reason,
      })),
      meta: metaOf(total, paging),
    });
  });

  app.get('/logs/export.xlsx', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = filterSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Filter tidak valid', details: parsed.error.issues },
      });
    }

    const rangeError = assertExportRange(parsed.data.from, parsed.data.to);
    if (rangeError) {
      return reply.status(400).send({ error: { code: 'RANGE_TOO_LARGE', message: rangeError } });
    }

    const where = buildWhere(parsed.data);
    const filename = `log-tap-${toDateKey(new Date(), SCHOOL_TZ).replace(/-/g, '')}.xlsx`;

    reply.hijack();
    reply.raw.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: reply.raw,
      useStyles: true,
    });
    const sheet = workbook.addWorksheet('Log Tap');

    sheet.columns = [
      { header: 'NIS/NIP', key: 'ident', width: 22 },
      { header: 'Nama', key: 'name', width: 30 },
      { header: 'Tipe', key: 'type', width: 10 },
      { header: 'Kelas', key: 'className', width: 10 },
      { header: 'Waktu', key: 'time', width: 22 },
      { header: 'Tipe Tap', key: 'tapType', width: 14 },
      { header: 'Keputusan', key: 'decision', width: 16 },
      { header: 'Alasan', key: 'reason', width: 24 },
      { header: 'Device', key: 'device', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).commit();

    const CHUNK = 500;
    let cursor: string | undefined;

    for (;;) {
      const batch = await app.prisma.tapLog.findMany({
        where,
        include: logInclude,
        orderBy: [{ tappedAt: 'asc' }, { id: 'asc' }],
        take: CHUNK,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (batch.length === 0) break;

      for (const row of batch) {
        sheet
          .addRow({
            ident: row.person?.nis ?? row.person?.nip ?? row.uid,
            name: row.person?.fullName ?? '(tidak dikenal)',
            type: row.person ? 'Siswa/Guru' : 'Kartu',
            className: row.person?.class?.name ?? '',
            time: new Intl.DateTimeFormat('id-ID', {
              timeZone: SCHOOL_TZ,
              dateStyle: 'short',
              timeStyle: 'medium',
            }).format(row.tappedAt),
            tapType: row.tapType ?? '',
            decision: row.decision,
            reason: row.reason ?? '',
            device: row.device.code,
          })
          .commit();
      }

      cursor = batch[batch.length - 1]?.id;
      if (batch.length < CHUNK) break;
    }

    sheet.commit();
    await workbook.commit();

    return reply;
  });

  app.patch(
    '/logs/:id',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const existing = await app.prisma.tapLog.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Log tidak ditemukan' } });
      }

      const updated = await app.prisma.tapLog.update({
        where: { id },
        data: {
          tapType: parsed.data.tapType,
          prayerSlot: parsed.data.prayerSlot,
          reason: parsed.data.reason,
          decision: 'ACCEPTED',
        },
      });

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'log.correct',
        entity: 'TapLog',
        entityId: id,
        before: existing,
        after: updated,
        ip: request.ip,
      });

      if (updated.personId) {
        const day = toDateKey(updated.tappedAt, SCHOOL_TZ);
        await recomputeRange(app.prisma, { from: day, to: day, personId: updated.personId });
      }

      return reply.send(updated);
    },
  );
}

export { TAP_TYPES, DECISIONS };
