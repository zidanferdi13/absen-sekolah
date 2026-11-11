import type { FastifyInstance } from 'fastify';
import type { AttendanceStatus } from '@prisma/client';
import { z } from 'zod';
import { recomputeRange, RecomputeError } from './recompute.js';
import { writeAuditLog } from '../../lib/audit.js';
import { SCHOOL_TZ, addDays, toDateKey, toDateOnly } from '../../lib/time.js';

const dateSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

const summarySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(['class', 'person']).default('class'),
});

const monthlySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

const recomputeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  personId: z.string().optional().nullable(),
});

const typeFilterSchema = z.enum(['STUDENT', 'TEACHER']).optional();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const rangeSchema = z
  .object({
    from: z.string().regex(DATE_RE).optional(),
    to: z.string().regex(DATE_RE).optional(),
    date: z.string().regex(DATE_RE).optional(),
    personType: typeFilterSchema,
  })
  .superRefine((value, ctx) => {
    if (value.date && (value.from || value.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gunakan date saja, atau from+to — jangan dicampur',
      });
      return;
    }
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tanggal awal harus sebelum tanggal akhir',
      });
      return;
    }
    if (value.from && value.to) {
      const days = diffRangeDays(value.from, value.to);
      if (days > MAX_RANGE_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rentang maksimum ${MAX_RANGE_DAYS} hari, diminta ${days} hari`,
        });
      }
    }
  });

const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  personType: typeFilterSchema,
});

const byClassQuerySchema = z.object({
  date: z.string().regex(DATE_RE).optional(),
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
});

function diffRangeDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

// Jumlah hari kerja (Senin-Jumat) dalam rentang, inklusif.
// Dipakai sebagai penyebut tingkat kehadiran: orang x hari kerja.
function countWorkdays(from: string, to: string): number {
  let count = 0;
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

interface ResolvedRange {
  fromKey: string;
  toKey: string;
  days: number;
  isSingleDay: boolean;
}

function resolveRange(
  input: { from?: string; to?: string; date?: string; days?: number },
  defaultDays = 1,
): ResolvedRange {
  const todayKey = toDateKey(new Date(), SCHOOL_TZ);

  if (input.date) {
    return { fromKey: input.date, toKey: input.date, days: 1, isSingleDay: true };
  }

  if (input.from && input.to) {
    const days = diffRangeDays(input.from, input.to);
    return { fromKey: input.from, toKey: input.to, days, isSingleDay: days === 1 };
  }

  if (input.from && !input.to) {
    return { fromKey: input.from, toKey: todayKey, days: diffRangeDays(input.from, todayKey), isSingleDay: false };
  }

  if (!input.from && input.to) {
    const span = input.days ?? defaultDays;
    const fromKey = addDays(input.to, -(span - 1));
    return { fromKey, toKey: input.to, days: span, isSingleDay: span === 1 };
  }

  if (input.days && input.days > 1) {
    const fromKey = addDays(todayKey, -(input.days - 1));
    return { fromKey, toKey: todayKey, days: input.days, isSingleDay: input.days === 1 };
  }

  return { fromKey: todayKey, toKey: todayKey, days: 1, isSingleDay: true };
}

const STATUSES: AttendanceStatus[] = ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALFA', 'LIBUR'];

function emptySummary(): Record<string, number> {
  const base = Object.fromEntries(STATUSES.map((status) => [status.toLowerCase(), 0]));
  return base as Record<string, number>;
}

export default async function attendanceRoutes(app: FastifyInstance) {
  app.get('/attendance/daily', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = dateSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Parameter date harus YYYY-MM-DD' },
      });
    }

    const { classId } = (request.query ?? {}) as { classId?: string };
    const date = toDateOnly(new Date(`${parsed.data.date}T00:00:00.000Z`));

    const persons = await app.prisma.person.findMany({
      where: { deletedAt: null, isActive: true, ...(classId ? { classId } : {}) },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        nis: true,
        nip: true,
        fullName: true,
        class: { select: { name: true } },
        attendance: { where: { date }, take: 1 },
      },
    });

    const summary = emptySummary();

    const data = persons.map((person) => {
      const record = person.attendance[0];
      const status: AttendanceStatus = record?.status ?? 'ALFA';
      const key = status.toLowerCase();
      summary[key] = (summary[key] ?? 0) + 1;

      return {
        personId: person.id,
        nis: person.nis,
        nip: person.nip,
        fullName: person.fullName,
        className: person.class?.name ?? null,
        status,
        checkInAt: record?.checkInAt ?? null,
        checkOutAt: record?.checkOutAt ?? null,
        lateMinutes: record?.lateMinutes ?? 0,
        prayerDhuhaAt: record?.prayerDhuhaAt ?? null,
        prayerDhuhurAt: record?.prayerDhuhurAt ?? null,
        prayerAsharAt: record?.prayerAsharAt ?? null,
      };
    });

    return reply.send({ data, summary });
  });

  app.get('/attendance/summary', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = summarySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter from/to wajib berformat YYYY-MM-DD',
        },
      });
    }

    const { from, to, groupBy } = parsed.data;
    const start = toDateOnly(new Date(`${from}T00:00:00.000Z`));
    const end = toDateOnly(new Date(`${to}T00:00:00.000Z`));

    const rows = await app.prisma.attendanceDaily.findMany({
      where: { date: { gte: start, lte: end } },
      select: {
        status: true,
        person: {
          select: { id: true, fullName: true, class: { select: { name: true } } },
        },
      },
    });

    const buckets = new Map<string, Record<string, number> & { label: string; key: string }>();

    for (const row of rows) {
      const key = groupBy === 'person' ? row.person.id : (row.person.class?.name ?? 'Tanpa Kelas');
      const label = groupBy === 'person' ? row.person.fullName : key;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { ...emptySummary(), key, label };
        buckets.set(key, bucket);
      }
      const statusKey = row.status.toLowerCase();
      bucket[statusKey] = (bucket[statusKey] ?? 0) + 1;
    }

    return reply.send({ data: Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label)) });
  });

  app.get('/attendance/monthly', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = monthlySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Parameter month harus YYYY-MM' },
      });
    }

    const { classId } = (request.query ?? {}) as { classId?: string };
    const [yearPart, monthPart] = parsed.data.month.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    const persons = await app.prisma.person.findMany({
      where: { deletedAt: null, isActive: true, ...(classId ? { classId } : {}) },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        class: { select: { name: true } },
        attendance: {
          where: { date: { gte: start, lte: end } },
          select: { date: true, status: true },
        },
      },
    });

    return reply.send({
      data: persons.map((person) => {
        const days: Record<string, AttendanceStatus> = {};
        for (const record of person.attendance) {
          const day = toDateKey(record.date, 'UTC').slice(8, 10);
          days[day] = record.status;
        }
        return {
          personId: person.id,
          fullName: person.fullName,
          className: person.class?.name ?? null,
          days,
        };
      }),
    });
  });

  app.get('/dashboard/stats', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = rangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Parameter tidak valid',
        },
      });
    }

    const range = resolveRange(parsed.data, 1);
    const startDate = toDateOnly(new Date(`${range.fromKey}T00:00:00.000Z`));
    const endDate = toDateOnly(new Date(`${range.toKey}T00:00:00.000Z`));
    const personType = parsed.data.personType;

    const personScope = {
      deletedAt: null,
      isActive: true,
      ...(personType ? { type: personType } : {}),
    };

    const attendanceScope = {
      date: range.isSingleDay ? startDate : { gte: startDate, lte: endDate },
      ...(personType ? { person: { type: personType } } : {}),
    };

    const tapScope = {
      tappedAt: {
        gte: startDate,
        lte: new Date(`${range.toKey}T23:59:59.999Z`),
      },
      ...(personType ? { person: { type: personType } } : {}),
    };

    const [students, teachers, grouped, totalTaps, activeDevices, prayer, tapByType, eligible] =
      await Promise.all([
        app.prisma.person.count({
          where: { type: 'STUDENT', deletedAt: null, isActive: true },
        }),
        app.prisma.person.count({
          where: { type: 'TEACHER', deletedAt: null, isActive: true },
        }),
        app.prisma.attendanceDaily.groupBy({
          by: ['status'],
          where: attendanceScope,
          _count: { _all: true },
        }),
        app.prisma.tapLog.count({ where: tapScope }),
        app.prisma.device.count({ where: { status: 'ACTIVE' } }),
        app.prisma.attendanceDaily.aggregate({
          where: attendanceScope,
          _count: {
            _all: true,
            prayerDhuhaAt: true,
            prayerDhuhurAt: true,
            prayerAsharAt: true,
          },
        }),
        app.prisma.tapLog.groupBy({
          by: ['decision'],
          where: tapScope,
          _count: { _all: true },
        }),
        app.prisma.person.count({ where: personScope }),
      ]);

    const counts: Record<string, number> = {};
    for (const row of grouped) counts[row.status] = row._count._all;

    const decisions: Record<string, number> = {};
    for (const row of tapByType) decisions[row.decision] = row._count._all;

    const workdays = countWorkdays(range.fromKey, range.toKey);
    const eligiblePersons = eligible * workdays;
    const present = (counts.HADIR ?? 0) + (counts.TERLAMBAT ?? 0);

    return reply.send({
      date: range.isSingleDay ? range.fromKey : null,
      from: range.fromKey,
      to: range.toKey,
      days: range.days,
      workdays,
      personType: personType ?? null,
      totalStudents: students,
      totalTeachers: teachers,
      eligiblePersons,
      hadir: counts.HADIR ?? 0,
      terlambat: counts.TERLAMBAT ?? 0,
      izin: counts.IZIN ?? 0,
      sakit: counts.SAKIT ?? 0,
      alfa: counts.ALFA ?? 0,
      libur: counts.LIBUR ?? 0,
      attendanceRate: eligiblePersons > 0 ? Math.round((present / eligiblePersons) * 100) : 0,
      totalTaps,
      activeDevices,
      taps: {
        accepted: decisions.ACCEPTED ?? 0,
        duplicate: decisions.DUPLICATE ?? 0,
        rejected: decisions.REJECTED ?? 0,
        unknownCard: decisions.UNKNOWN_CARD ?? 0,
      },
      prayer: {
        dhuha: prayer._count.prayerDhuhaAt,
        dhuhur: prayer._count.prayerDhuhurAt,
        ashar: prayer._count.prayerAsharAt,
      },
    });
  });

  app.get('/dashboard/trend', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = trendQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Parameter tidak valid' },
      });
    }

    const range = resolveRange(parsed.data, 7);
    if (range.days > 90) {
      return reply.status(400).send({
        error: { code: 'RANGE_TOO_LARGE', message: 'Rentang grafik maksimum 90 hari' },
      });
    }

    const { personType } = parsed.data;
    const startDate = toDateOnly(new Date(`${range.fromKey}T00:00:00.000Z`));
    const endDate = toDateOnly(new Date(`${range.toKey}T00:00:00.000Z`));

    const rows = await app.prisma.attendanceDaily.groupBy({
      by: ['date', 'status'],
      where: {
        date: { gte: startDate, lte: endDate },
        ...(personType ? { person: { type: personType } } : {}),
      },
      _count: { _all: true },
    });

    const byDate = new Map<string, Record<string, number>>();
    for (let offset = 0; offset < range.days; offset += 1) {
      byDate.set(addDays(range.fromKey, offset), emptySummary());
    }

    for (const row of rows) {
      const key = toDateKey(row.date, 'UTC');
      const bucket = byDate.get(key);
      if (!bucket) continue;
      bucket[row.status.toLowerCase()] = row._count._all;
    }

    return reply.send({
      from: range.fromKey,
      to: range.toKey,
      personType: personType ?? null,
      data: Array.from(byDate.entries()).map(([date, counts]) => ({ date, ...counts })),
    });
  });

  app.get('/dashboard/by-class', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = byClassQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Parameter tanggal tidak valid' },
      });
    }

    const range = resolveRange(parsed.data, 1);
    const startDate = toDateOnly(new Date(`${range.fromKey}T00:00:00.000Z`));
    const endDate = toDateOnly(new Date(`${range.toKey}T00:00:00.000Z`));
    const workdays = Math.max(1, countWorkdays(range.fromKey, range.toKey));

    const classes = await app.prisma.classRoom.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        _count: {
          select: { students: { where: { deletedAt: null, isActive: true } } },
        },
      },
    });

    const grouped = await app.prisma.attendanceDaily.groupBy({
      by: ['status'],
      where: {
        date: range.isSingleDay ? startDate : { gte: startDate, lte: endDate },
        person: { type: 'STUDENT', classId: { not: null } },
      },
      _count: { _all: true },
    });

    const perClass = await app.prisma.attendanceDaily.findMany({
      where: {
        date: range.isSingleDay ? startDate : { gte: startDate, lte: endDate },
        person: { type: 'STUDENT', classId: { not: null } },
      },
      select: { status: true, person: { select: { classId: true } } },
    });

    const buckets = new Map<string, Record<string, number>>();
    for (const row of perClass) {
      const classId = row.person.classId;
      if (!classId) continue;
      const bucket = buckets.get(classId) ?? {};
      bucket[row.status.toLowerCase()] = (bucket[row.status.toLowerCase()] ?? 0) + 1;
      buckets.set(classId, bucket);
    }

    const totalStudents = classes.reduce((sum, room) => sum + room._count.students, 0);

    return reply.send({
      date: range.isSingleDay ? range.fromKey : null,
      from: range.fromKey,
      to: range.toKey,
      workdays,
      totalStudents,
      summary: Object.fromEntries(grouped.map((row) => [row.status.toLowerCase(), row._count._all])),
      data: classes.map((room) => {
        const bucket = buckets.get(room.id) ?? {};
        const present = (bucket.hadir ?? 0) + (bucket.terlambat ?? 0);
        const enrolled = room._count.students;
        const eligible = enrolled * workdays;
        return {
          classId: room.id,
          className: room.name,
          students: enrolled,
          hadir: bucket.hadir ?? 0,
          terlambat: bucket.terlambat ?? 0,
          alfa: bucket.alfa ?? 0,
          attendanceRate: eligible > 0 ? Math.round((present / eligible) * 100) : 0,
        };
      }),
    });
  });

  app.post(
    '/attendance/recompute',
    { preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN') },
    async (request, reply) => {
      const parsed = recomputeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      try {
        const result = await recomputeRange(app.prisma, parsed.data);

        await writeAuditLog(app.prisma, {
          actorUserId: request.user.sub,
          action: 'attendance.recompute',
          entity: 'AttendanceDaily',
          entityId: `${parsed.data.from}..${parsed.data.to}`,
          after: result,
          ip: request.ip,
        });

        return reply.send(result);
      } catch (err) {
        if (err instanceof RecomputeError) {
          const status = err.code === 'RANGE_TOO_LARGE' ? 400 : 400;
          return reply.status(status).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );
}
