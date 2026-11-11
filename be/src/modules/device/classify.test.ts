import { describe, expect, it } from 'vitest';
import {
  classify,
  selectRule,
  toLocalParts,
  type RuleLike,
  type SubjectLike,
} from './classify.js';

const TZ = 'Asia/Jakarta';

/** 2026-11-11 adalah hari Rabu (dayOfWeek = 3). */
const makeLocalAt = (hour: number, minute: number, dayOfWeek = 3, dateKey = '2026-11-11') => ({
  dayOfWeek,
  minuteOfDay: hour * 60 + minute,
  dateKey,
});

const at = (isoLocal: string) => new Date(isoLocal);

const baseRule = (overrides: Partial<RuleLike> = {}): RuleLike => ({
  id: 'rule-1',
  type: 'CLOCK_IN',
  prayerSlot: null,
  scope: 'GLOBAL',
  classId: null,
  personId: null,
  daysOfWeek: [1, 2, 3, 4, 5],
  startMinute: 6 * 60,
  endMinute: 7 * 60 + 15,
  minGapMinutes: 2,
  priority: 0,
  validFrom: null,
  validTo: null,
  isActive: true,
  ...overrides,
});

const clockOutRule = baseRule({
  id: 'rule-out',
  type: 'CLOCK_OUT',
  startMinute: 13 * 60,
  endMinute: 16 * 60,
});

const prayerRule = (slot: 'DHUHA' | 'DHUHUR' | 'ASHAR', start: number, end: number): RuleLike =>
  baseRule({
    id: `rule-${slot}`,
    type: 'PRAYER',
    prayerSlot: slot,
    startMinute: start,
    endMinute: end,
    priority: 10,
    minGapMinutes: 1,
  });

const student: SubjectLike = { id: 'p-1', classId: 'c-7a' };

const rules = [
  baseRule(),
  clockOutRule,
  prayerRule('DHUHA', 9 * 60 + 30, 10 * 60 + 15),
  prayerRule('DHUHUR', 11 * 60 + 45, 12 * 60 + 45),
  prayerRule('ASHAR', 15 * 60, 15 * 60 + 45),
];

const run = (
  opts: {
    local: ReturnType<typeof makeLocalAt>;
    tappedAt?: string;
    subject?: SubjectLike | null;
    rules?: RuleLike[];
    lastAcceptedTapAt?: string | null;
  },
) =>
  classify({
    tappedAt: at(opts.tappedAt ?? '2026-11-11T00:00:00Z'),
    local: opts.local,
    subject: opts.subject === undefined ? student : opts.subject,
    rules: opts.rules ?? rules,
    lastAcceptedTapAt: opts.lastAcceptedTapAt ? at(opts.lastAcceptedTapAt) : null,
  });

describe('classify() — window & tipe tap', () => {
  it('01. tap 06:45 Senin -> CLOCK_IN', () => {
    const r = run({ local: makeLocalAt(6, 45, 1) });
    expect(r.decision).toBe('ACCEPTED');
    expect(r.tapType).toBe('CLOCK_IN');
  });

  it('02. tap 07:10 Senin (dalam window) -> CLOCK_IN', () => {
    const r = run({ local: makeLocalAt(7, 10, 1) });
    expect(r.decision).toBe('ACCEPTED');
    expect(r.tapType).toBe('CLOCK_IN');
  });

  it('03. tap 07:20 -> tetap CLOCK_IN (status ditentukan applyTap)', () => {
    const r = run({ local: makeLocalAt(7, 20, 1), rules: [baseRule({ endMinute: 8 * 60 })] });
    expect(r.tapType).toBe('CLOCK_IN');
  });

  it('04. tap 08:00 di luar semua window -> REJECTED OUT_OF_WINDOW', () => {
    const r = run({ local: makeLocalAt(8, 0, 1) });
    expect(r.decision).toBe('REJECTED');
    expect(r.reason).toBe('OUT_OF_WINDOW');
  });

  it('05. tap 09:45 -> PRAYER DHUHA', () => {
    const r = run({ local: makeLocalAt(9, 45, 1) });
    expect(r.tapType).toBe('PRAYER');
    expect(r.prayerSlot).toBe('DHUHA');
  });

  it('06. tap 12:00 -> PRAYER DHUHUR', () => {
    const r = run({ local: makeLocalAt(12, 0, 1) });
    expect(r.prayerSlot).toBe('DHUHUR');
  });

  it('07. tap 15:20 -> PRAYER ASHAR', () => {
    const r = run({ local: makeLocalAt(15, 20, 1) });
    expect(r.prayerSlot).toBe('ASHAR');
  });

  it('08. tap 14:00 -> CLOCK_OUT', () => {
    const r = run({ local: makeLocalAt(14, 0, 1) });
    expect(r.tapType).toBe('CLOCK_OUT');
  });

  it('11. tap Sabtu 08:00 dengan rule Sabtu -> OTHER', () => {
    const sabtuRule = baseRule({
      id: 'rule-ekskul',
      type: 'OTHER',
      daysOfWeek: [6],
      startMinute: 7 * 60,
      endMinute: 12 * 60,
    });
    const r = run({ local: makeLocalAt(8, 0, 6), rules: [sabtuRule] });
    expect(r.tapType).toBe('OTHER');
    expect(r.decision).toBe('ACCEPTED');
  });

  it('12. tap Minggu -> REJECTED (tidak ada rule hari Minggu)', () => {
    const r = run({ local: makeLocalAt(7, 0, 0) });
    expect(r.decision).toBe('REJECTED');
  });
});

describe('classify() — duplikasi', () => {
  it('09. tap kedua 1 menit kemudian -> DUPLICATE', () => {
    const r = run({
      local: makeLocalAt(6, 46, 1),
      tappedAt: '2026-11-10T23:46:00Z',
      lastAcceptedTapAt: '2026-11-10T23:45:00Z',
    });
    expect(r.decision).toBe('DUPLICATE');
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('10. tap kedua 3 menit kemudian -> ACCEPTED', () => {
    const r = run({
      local: makeLocalAt(6, 48, 1),
      tappedAt: '2026-11-10T23:48:00Z',
      lastAcceptedTapAt: '2026-11-10T23:45:00Z',
    });
    expect(r.decision).toBe('ACCEPTED');
  });
});

describe('classify() — kartu', () => {
  it('14. kartu tidak terdaftar -> UNKNOWN_CARD', () => {
    const r = run({ local: makeLocalAt(7, 0, 1), subject: null });
    expect(r.decision).toBe('UNKNOWN_CARD');
    expect(r.reason).toBe('CARD_NOT_REGISTERED');
    expect(r.tapType).toBeNull();
  });
});

describe('classify() — prioritas rule', () => {
  it('16. rule PERSON mengalahkan rule CLASS', () => {
    const classRule = baseRule({ id: 'class', scope: 'CLASS', classId: 'c-7a', type: 'CLOCK_IN' });
    const personRule = baseRule({ id: 'person', scope: 'PERSON', personId: 'p-1', type: 'OTHER' });
    const decision = selectRule([classRule, personRule], makeLocalAt(7, 0, 1), student);
    expect(decision?.id).toBe('person');
  });

  it('17. rule CLASS mengalahkan rule GLOBAL', () => {
    const globalRule = baseRule({ id: 'global', scope: 'GLOBAL', type: 'CLOCK_IN' });
    const classRule = baseRule({ id: 'class', scope: 'CLASS', classId: 'c-7a', type: 'OTHER' });
    const decision = selectRule([globalRule, classRule], makeLocalAt(7, 0, 1), student);
    expect(decision?.id).toBe('class');
  });

  it('18. dua rule GLOBAL overlap -> priority lebih tinggi menang', () => {
    const low = baseRule({ id: 'low', priority: 0 });
    const high = baseRule({ id: 'high', priority: 5, type: 'OTHER' });
    const decision = selectRule([low, high], makeLocalAt(7, 0, 1), student);
    expect(decision?.id).toBe('high');
  });

  it('19. rule dengan validTo terlewat tidak dipakai', () => {
    const expired = baseRule({
      id: 'expired',
      priority: 99,
      validFrom: new Date('2026-11-01'),
      validTo: new Date('2026-11-10'),
    });
    const active = baseRule({ id: 'active' });
    const decision = selectRule([expired, active], makeLocalAt(7, 0, 3), student);
    expect(decision?.id).toBe('active');
  });
});

describe('toLocalParts()', () => {
  it('mengonversi UTC ke Asia/Jakarta dengan benar', () => {
    // 2026-11-11T00:30:00Z = 07:30 WIB hari Rabu
    const parts = toLocalParts(new Date('2026-11-11T00:30:00Z'), TZ);
    expect(parts.dateKey).toBe('2026-11-11');
    expect(parts.dayOfWeek).toBe(3);
    expect(parts.minuteOfDay).toBe(7 * 60 + 30);
  });

  it('menangani pergantian hari akibat offset +7', () => {
    // 2026-11-10T18:00:00Z = 01:00 WIB tanggal 11
    const parts = toLocalParts(new Date('2026-11-10T18:00:00Z'), TZ);
    expect(parts.dateKey).toBe('2026-11-11');
  });
});
