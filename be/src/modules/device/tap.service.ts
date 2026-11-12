import { PrismaClient, Prisma } from '@prisma/client';
import { classify, toLocalParts, type PrayerSlot, type RuleLike } from './classify.js';
import { applyTap, emptyDaily, type DailyState } from '../attendance/apply-tap.js';
import { SCHOOL_TZ, toDateOnly } from '../../lib/time.js';

export interface TapRequest {
  deviceId: string;
  uid: string;
  deviceTs: Date | null;
  idempotencyKey: string;
  rawPayload?: Prisma.InputJsonValue;
}

export interface TapResponse {
  decision: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED' | 'UNKNOWN_CARD';
  tapType: string | null;
  person: {
    name: string;
    type: string;
    nis: string | null;
    nip: string | null;
    className: string | null;
    photoUrl: string | null;
  } | null;
  status: string | null;
  message: string;
  serverTime: string;
  retryAfterSeconds?: number;
}

const normalizeUid = (uid: string): string => uid.trim().replace(/[\s:-]/g, '').toUpperCase();

async function loadRules(prisma: PrismaClient): Promise<RuleLike[]> {
  const rules = await prisma.tapRule.findMany({ where: { isActive: true } });
  return rules.map((rule) => ({
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
}

async function getSchoolConfig(prisma: PrismaClient) {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['school.startMinute', 'school.graceMinutes'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    startMinute: Number(map.get('school.startMinute') ?? 7 * 60),
    graceMinutes: Number(map.get('school.graceMinutes') ?? 15),
  };
}

export async function handleTap(
  prisma: PrismaClient,
  req: TapRequest,
): Promise<TapResponse> {
  const uid = normalizeUid(req.uid);
  const tappedAt = new Date();
  const local = toLocalParts(tappedAt, SCHOOL_TZ);

  const existing = await prisma.tapLog.findUnique({
    where: { idempotencyKey: req.idempotencyKey },
  });

  if (existing) {
    // Retry dari perangkat: jawab sama seperti sebelumnya tanpa menulis ulang.
    return replay(prisma, existing);
  }

  const card = await prisma.rfidCard.findUnique({
    where: { uid },
    include: { person: { include: { class: true } } },
  });

  const person =
    card && card.status === 'ACTIVE' && card.person && card.person.deletedAt === null
      ? card.person
      : null;

  const subject = person ? { id: person.id, classId: person.classId } : null;

  const [rules, config] = await Promise.all([loadRules(prisma), getSchoolConfig(prisma)]);

  const lastAccepted = person
    ? await prisma.tapLog.findFirst({
        where: {
          personId: person.id,
          decision: 'ACCEPTED',
          tappedAt: { gte: new Date(tappedAt.getTime() - 12 * 60 * 60 * 1000) },
        },
        orderBy: { tappedAt: 'desc' },
      })
    : null;

  const result = classify({
    tappedAt,
    local,
    subject,
    rules,
    lastAcceptedTapAt: lastAccepted?.tappedAt ?? null,
  });

  const log = await prisma.tapLog.create({
    data: {
      uid,
      deviceId: req.deviceId,
      personId: person?.id ?? null,
      tappedAt,
      deviceTs: req.deviceTs,
      tapType: result.tapType,
      prayerSlot: result.prayerSlot,
      decision: result.decision,
      ruleId: result.ruleId,
      reason: result.reason,
      rawPayload: req.rawPayload,
      idempotencyKey: req.idempotencyKey,
    },
  });

  let status: string | null = null;

  if (person && result.decision === 'ACCEPTED' && result.tapType && result.tapType !== 'OTHER') {
    status = await upsertAttendance(prisma, person.id, tappedAt, result.tapType, result.prayerSlot, config);
  }

  return buildResponse(result, person, status, tappedAt, log.decision);
}

async function upsertAttendance(
  prisma: PrismaClient,
  personId: string,
  tappedAt: Date,
  tapType: 'CLOCK_IN' | 'CLOCK_OUT' | 'PRAYER' | 'OTHER',
  prayerSlot: 'DHUHA' | 'DHUHUR' | 'ASHAR' | null,
  config: { startMinute: number; graceMinutes: number },
): Promise<string> {
  const date = toDateOnly(tappedAt);

  const current = await prisma.attendanceDaily.findUnique({
    where: { personId_date: { personId, date } },
  });

  const before: DailyState = current
    ? {
        status: current.status,
        checkInAt: current.checkInAt,
        checkOutAt: current.checkOutAt,
        lateMinutes: current.lateMinutes,
        prayerDhuhaAt: current.prayerDhuhaAt,
        prayerDhuhurAt: current.prayerDhuhurAt,
        prayerAsharAt: current.prayerAsharAt,
      }
    : emptyDaily();

  const after = applyTap(before, { tapType, prayerSlot, tappedAt }, config, SCHOOL_TZ);

  await prisma.attendanceDaily.upsert({
    where: { personId_date: { personId, date } },
    create: { personId, date, ...after, computedAt: new Date() },
    update: { ...after, computedAt: new Date() },
  });

  return after.status;
}

async function replay(prisma: PrismaClient, log: {
  decision: string;
  tapType: string | null;
  personId: string | null;
  tappedAt: Date;
  reason: string | null;
}) {
  const person = log.personId
    ? await prisma.person.findUnique({ where: { id: log.personId }, include: { class: true } })
    : null;

  const date = toDateOnly(log.tappedAt);
  const attendance = log.personId
    ? await prisma.attendanceDaily.findUnique({
        where: { personId_date: { personId: log.personId, date } },
      })
    : null;

  return buildResponse(
    {
      decision: log.decision as TapResponse['decision'],
      tapType: log.tapType as TapResponse['tapType'],
      prayerSlot: null,
      ruleId: null,
      reason: log.reason,
      retryAfterSeconds: null,
    },
    person,
    attendance?.status ?? null,
    log.tappedAt,
    log.decision as TapResponse['decision'],
  );
}

function buildResponse(
  result: {
    decision: TapResponse['decision'];
    tapType: string | null;
    prayerSlot?: PrayerSlot | null;
    ruleId?: string | null;
    reason?: string | null;
    retryAfterSeconds?: number | null;
  },
  person: { fullName: string; type: string; nis: string | null; nip: string | null; photoUrl: string | null; class: { name: string } | null } | null,
  status: string | null,
  at: Date,
  _decision: string,
): TapResponse {
  const messages: Record<string, string> = {
    ACCEPTED: person ? `Selamat, ${person.fullName}` : 'Tap diterima',
    DUPLICATE: 'Kartu baru saja di-tap. Coba lagi sebentar.',
    REJECTED: 'Di luar jam absensi.',
    UNKNOWN_CARD: 'Kartu tidak dikenal.',
  };

  const response: TapResponse = {
    decision: result.decision,
    tapType: result.tapType,
    person: person
      ? {
          name: person.fullName,
          type: person.type,
          nis: person.nis,
          nip: person.nip,
          className: person.class?.name ?? null,
          photoUrl: person.photoUrl,
        }
      : null,
    status,
    message: messages[result.decision] ?? 'Tap diproses',
    serverTime: at.toISOString(),
  };

  if (result.retryAfterSeconds != null) {
    response.retryAfterSeconds = result.retryAfterSeconds;
  }

  return response;
}
