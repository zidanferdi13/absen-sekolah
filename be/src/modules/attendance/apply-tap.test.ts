import { beforeEach, describe, expect, it } from 'vitest';
import { applyTap, emptyDaily, type DailyState } from './apply-tap.js';

const TZ = 'Asia/Jakarta';
const config = { startMinute: 7 * 60, graceMinutes: 15 };

const tap = (iso: string) => new Date(iso);

let state: DailyState;
beforeEach(() => {
  state = emptyDaily();
});

describe('applyTap() — clock in', () => {
  it('tap 06:45 WIB -> HADIR tanpa late', () => {
    const next = applyTap(
      state,
      { tapType: 'CLOCK_IN', prayerSlot: null, tappedAt: tap('2026-11-11T06:45:00+07:00') },
      config,
      TZ,
    );
    expect(next.status).toBe('HADIR');
    expect(next.lateMinutes).toBe(0);
    expect(next.checkInAt?.toISOString()).toBe('2026-11-10T23:45:00.000Z');
  });

  it('tap 07:10 WIB masih dalam grace -> HADIR', () => {
    const next = applyTap(
      state,
      { tapType: 'CLOCK_IN', prayerSlot: null, tappedAt: tap('2026-11-11T07:10:00+07:00') },
      config,
      TZ,
    );
    expect(next.status).toBe('HADIR');
    expect(next.lateMinutes).toBe(0);
  });

  it('tap 07:20 WIB -> TERLAMBAT 5 menit', () => {
    const next = applyTap(
      state,
      { tapType: 'CLOCK_IN', prayerSlot: null, tappedAt: tap('2026-11-11T07:20:00+07:00') },
      config,
      TZ,
    );
    expect(next.status).toBe('TERLAMBAT');
    expect(next.lateMinutes).toBe(5);
  });

  it('20. clock-in kedua tidak menimpa jam masuk', () => {
    const first = applyTap(
      state,
      { tapType: 'CLOCK_IN', prayerSlot: null, tappedAt: tap('2026-11-11T06:45:00+07:00') },
      config,
      TZ,
    );
    const second = applyTap(
      first,
      { tapType: 'CLOCK_IN', prayerSlot: null, tappedAt: tap('2026-11-11T07:10:00+07:00') },
      config,
      TZ,
    );
    expect(second.checkInAt?.toISOString()).toBe('2026-11-10T23:45:00.000Z');
    expect(second.status).toBe('HADIR');
  });
});

describe('applyTap() — clock out', () => {
  it('menyimpan tap keluar terakhir', () => {
    const a = applyTap(
      state,
      { tapType: 'CLOCK_OUT', prayerSlot: null, tappedAt: tap('2026-11-11T14:00:00+07:00') },
      config,
      TZ,
    );
    const b = applyTap(
      a,
      { tapType: 'CLOCK_OUT', prayerSlot: null, tappedAt: tap('2026-11-11T15:00:00+07:00') },
      config,
      TZ,
    );
    expect(b.checkOutAt?.toISOString()).toBe('2026-11-11T08:00:00.000Z');
  });
});

describe('applyTap() — sholat', () => {
  it('mengisi slot sholat sesuai jenisnya', () => {
    const dhuha = applyTap(
      state,
      { tapType: 'PRAYER', prayerSlot: 'DHUHA', tappedAt: tap('2026-11-11T09:45:00+07:00') },
      config,
      TZ,
    );
    const dhuhur = applyTap(
      dhuha,
      { tapType: 'PRAYER', prayerSlot: 'DHUHUR', tappedAt: tap('2026-11-11T12:00:00+07:00') },
      config,
      TZ,
    );
    const ashar = applyTap(
      dhuhur,
      { tapType: 'PRAYER', prayerSlot: 'ASHAR', tappedAt: tap('2026-11-11T15:20:00+07:00') },
      config,
      TZ,
    );
    expect(ashar.prayerDhuhaAt).not.toBeNull();
    expect(ashar.prayerDhuhurAt).not.toBeNull();
    expect(ashar.prayerAsharAt).not.toBeNull();
  });

  it('tap sholat tidak mengubah status absensi', () => {
    const next = applyTap(
      state,
      { tapType: 'PRAYER', prayerSlot: 'DHUHA', tappedAt: tap('2026-11-11T09:45:00+07:00') },
      config,
      TZ,
    );
    expect(next.status).toBe('ALFA');
    expect(next.checkInAt).toBeNull();
  });
});

describe('applyTap() — OTHER', () => {
  it('tidak mengubah apa pun', () => {
    const next = applyTap(
      state,
      { tapType: 'OTHER', prayerSlot: null, tappedAt: tap('2026-11-11T10:00:00+07:00') },
      config,
      TZ,
    );
    expect(next).toEqual(state);
  });
});
