import type { PrismaClient } from '@prisma/client';
import {
  applyTap,
  emptyDaily,
  type DailyState,
  type PrayerSlot,
  type TapType,
} from './apply-tap.js';
import { SCHOOL_TZ, toDateKey, toDateOnly } from '../../lib/time.js';

const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class RecomputeError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface TapRow {
  personId: string | null;
  tappedAt: Date;
  tapType: TapType | null;
  prayerSlot: PrayerSlot | null;
}

function assertDate(value: string, field: string): void {
  if (!DATE_RE.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new RecomputeError('VALIDATION_ERROR', `Parameter ${field} harus berformat YYYY-MM-DD`);
  }
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime();
  const b = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

export async function loadSchoolConfig(prisma: PrismaClient) {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['school.startMinute', 'school.graceMinutes'] } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    startMinute: Number(map.get('school.startMinute') ?? 420),
    graceMinutes: Number(map.get('school.graceMinutes') ?? 15),
  };
}

export interface RecomputeOptions {
  from: string;
  to: string;
  personId?: string | null;
}

export interface RecomputeResult {
  rows: number;
  days: number;
  persons: number;
}

export async function recomputeRange(
  prisma: PrismaClient,
  options: RecomputeOptions,
): Promise<RecomputeResult> {
  assertDate(options.from, 'from');
  assertDate(options.to, 'to');

  if (options.from > options.to) {
    throw new RecomputeError('VALIDATION_ERROR', 'Rentang tanggal terbalik');
  }

  const totalDays = diffDays(options.from, options.to);
  if (totalDays > MAX_RANGE_DAYS) {
    throw new RecomputeError(
      'RANGE_TOO_LARGE',
      `Rentang maksimum ${MAX_RANGE_DAYS} hari, diminta ${totalDays} hari`,
    );
  }

  const startDate = toDateOnly(new Date(`${options.from}T00:00:00.000Z`));
  const endDate = toDateOnly(new Date(`${options.to}T00:00:00.000Z`));

  const [config, persons, holidays, taps] = await Promise.all([
    loadSchoolConfig(prisma),
    prisma.person.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(options.personId ? { id: options.personId } : {}),
      },
      select: { id: true },
    }),
    prisma.holiday.findMany({ where: { date: { gte: startDate, lte: endDate } } }),
    prisma.tapLog.findMany({
      where: {
        decision: 'ACCEPTED',
        personId: options.personId ? options.personId : { not: null },
        tappedAt: { gte: startDate, lte: new Date(`${options.to}T23:59:59.999Z`) },
      },
      select: { personId: true, tappedAt: true, tapType: true, prayerSlot: true },
      orderBy: { tappedAt: 'asc' },
    }),
  ]);

  const holidayByDate = new Map(
    holidays.map((holiday) => [holiday.date.toISOString().slice(0, 10), holiday.isSchoolDay]),
  );

  const tapsByPersonDay = new Map<string, TapRow[]>();
  for (const tap of taps) {
    if (!tap.personId) continue;
    const key = `${tap.personId}|${toDateKey(tap.tappedAt, SCHOOL_TZ)}`;
    const list = tapsByPersonDay.get(key);
    if (list) list.push(tap);
    else tapsByPersonDay.set(key, [tap]);
  }

  const dateKeys: string[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    dateKeys.push(addDays(options.from, offset));
  }

  const rows: Array<DailyState & { personId: string; date: Date }> = [];

  for (const person of persons) {
    for (const dateKey of dateKeys) {
      const dayOfWeek = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const holidayFlag = holidayByDate.get(dateKey);

      if (holidayFlag === false) {
        rows.push({
          ...emptyDaily(),
          status: 'LIBUR',
          personId: person.id,
          date: toDateOnly(new Date(`${dateKey}T00:00:00.000Z`)),
        });
        continue;
      }

      const dayTaps = tapsByPersonDay.get(`${person.id}|${dateKey}`) ?? [];
      let state = emptyDaily();

      for (const tap of dayTaps) {
        if (!tap.tapType) continue;
        state = applyTap(
          state,
          { tapType: tap.tapType, prayerSlot: tap.prayerSlot, tappedAt: tap.tappedAt },
          config,
          SCHOOL_TZ,
        );
      }

      rows.push({
        ...state,
        personId: person.id,
        date: toDateOnly(new Date(`${dateKey}T00:00:00.000Z`)),
      });
    }
  }

  const computedAt = new Date();

  await prisma.$transaction(
    rows.map((row) =>
      prisma.attendanceDaily.upsert({
        where: { personId_date: { personId: row.personId, date: row.date } },
        create: {
          personId: row.personId,
          date: row.date,
          status: row.status,
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
          lateMinutes: row.lateMinutes,
          prayerDhuhaAt: row.prayerDhuhaAt,
          prayerDhuhurAt: row.prayerDhuhurAt,
          prayerAsharAt: row.prayerAsharAt,
          computedAt,
        },
        update: {
          status: row.status,
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
          lateMinutes: row.lateMinutes,
          prayerDhuhaAt: row.prayerDhuhaAt,
          prayerDhuhurAt: row.prayerDhuhurAt,
          prayerAsharAt: row.prayerAsharAt,
          computedAt,
        },
      }),
    ),
  );

  return { rows: rows.length, days: totalDays, persons: persons.length };
}
