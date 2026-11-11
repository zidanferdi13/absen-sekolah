/**
 * Pure classification logic.
 *
 * Dipisah dari HTTP/DB agar bisa diuji cepat tanpa Prisma.
 * Waktu lokal (hari & menit) dihitung di luar fungsi ini oleh `toLocalParts`,
 * sehingga fungsi ini deterministik dan tidak bergantung pada timezone runtime.
 */

export type TapType = 'CLOCK_IN' | 'CLOCK_OUT' | 'PRAYER' | 'OTHER';
export type PrayerSlot = 'DHUHA' | 'DHUHUR' | 'ASHAR';
export type RuleScope = 'GLOBAL' | 'CLASS' | 'PERSON';
export type TapDecision = 'ACCEPTED' | 'DUPLICATE' | 'REJECTED' | 'UNKNOWN_CARD';

export interface RuleLike {
  id: string;
  type: TapType;
  prayerSlot: PrayerSlot | null;
  scope: RuleScope;
  classId: string | null;
  personId: string | null;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  minGapMinutes: number;
  priority: number;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
}

export interface SubjectLike {
  id: string;
  classId: string | null;
}

export interface LocalParts {
  /** 0 = Minggu .. 6 = Sabtu */
  dayOfWeek: number;
  /** menit sejak 00:00 waktu lokal sekolah */
  minuteOfDay: number;
  /** "YYYY-MM-DD" waktu lokal sekolah */
  dateKey: string;
}

export interface ClassifyInput {
  /** waktu tap menurut server */
  tappedAt: Date;
  /** hasil konversi tappedAt ke zona waktu sekolah */
  local: LocalParts;
  /** null berarti kartu tidak terdaftar */
  subject: SubjectLike | null;
  rules: RuleLike[];
  /** tap ACCEPTED terakhir untuk orang yang sama pada hari yang sama */
  lastAcceptedTapAt: Date | null;
}

export interface ClassifyResult {
  decision: TapDecision;
  tapType: TapType | null;
  prayerSlot: PrayerSlot | null;
  ruleId: string | null;
  reason: string | null;
  retryAfterSeconds: number | null;
}

const SCOPE_RANK: Record<RuleScope, number> = { PERSON: 3, CLASS: 2, GLOBAL: 1 };

function inValidityRange(rule: RuleLike, dateKey: string): boolean {
  if (rule.validFrom) {
    const from = rule.validFrom.toISOString().slice(0, 10);
    if (dateKey < from) return false;
  }
  if (rule.validTo) {
    const to = rule.validTo.toISOString().slice(0, 10);
    if (dateKey > to) return false;
  }
  return true;
}

function matchesScope(rule: RuleLike, subject: SubjectLike): boolean {
  switch (rule.scope) {
    case 'PERSON':
      return rule.personId === subject.id;
    case 'CLASS':
      return subject.classId !== null && rule.classId === subject.classId;
    case 'GLOBAL':
      return true;
    default:
      return false;
  }
}

export function selectRule(
  rules: RuleLike[],
  local: LocalParts,
  subject: SubjectLike,
): RuleLike | null {
  const candidates = rules.filter(
    (rule) =>
      rule.isActive &&
      matchesScope(rule, subject) &&
      rule.daysOfWeek.includes(local.dayOfWeek) &&
      local.minuteOfDay >= rule.startMinute &&
      local.minuteOfDay <= rule.endMinute &&
      inValidityRange(rule, local.dateKey),
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const byScope = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
    if (byScope !== 0) return byScope;
    if (b.priority !== a.priority) return b.priority - a.priority;
    // window lebih sempit dianggap lebih spesifik
    return a.endMinute - a.startMinute - (b.endMinute - b.startMinute);
  });

  return candidates[0] ?? null;
}

export function classify(input: ClassifyInput): ClassifyResult {
  const { subject, local, rules, tappedAt, lastAcceptedTapAt } = input;

  if (!subject) {
    return {
      decision: 'UNKNOWN_CARD',
      tapType: null,
      prayerSlot: null,
      ruleId: null,
      reason: 'CARD_NOT_REGISTERED',
      retryAfterSeconds: null,
    };
  }

  const rule = selectRule(rules, local, subject);
  if (!rule) {
    return {
      decision: 'REJECTED',
      tapType: null,
      prayerSlot: null,
      ruleId: null,
      reason: 'OUT_OF_WINDOW',
      retryAfterSeconds: null,
    };
  }

  if (lastAcceptedTapAt) {
    const gapMs = tappedAt.getTime() - lastAcceptedTapAt.getTime();
    const gapMinutes = gapMs / 60000;
    if (gapMinutes < rule.minGapMinutes) {
      return {
        decision: 'DUPLICATE',
        tapType: rule.type,
        prayerSlot: rule.prayerSlot,
        ruleId: rule.id,
        reason: 'TOO_SOON',
        retryAfterSeconds: Math.ceil(rule.minGapMinutes * 60 - gapMs / 1000),
      };
    }
  }

  return {
    decision: 'ACCEPTED',
    tapType: rule.type,
    prayerSlot: rule.prayerSlot,
    ruleId: rule.id,
    reason: null,
    retryAfterSeconds: null,
  };
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Konversi instant ke komponen waktu lokal sekolah.
 * Kalau tanggal tidak valid, lempar error agar tidak diam-diam salah hitung.
 */
export function toLocalParts(date: Date, timeZone: string): LocalParts {
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekday = pick('weekday');
  const dayOfWeek = WEEKDAY_INDEX[weekday];
  if (dayOfWeek === undefined) {
    throw new Error(`Unknown weekday: ${weekday}`);
  }

  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const hour = Number(pick('hour'));
  const minute = Number(pick('minute'));

  return {
    dayOfWeek,
    minuteOfDay: hour * 60 + minute,
    dateKey: `${year}-${month}-${day}`,
  };
}
