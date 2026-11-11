/**
 * Menerapkan satu tap ACCEPTED ke rekap harian.
 * Pure function: menerima state lama, mengembalikan state baru.
 * Dipakai baik oleh jalur realtime maupun oleh job recompute,
 * supaya hasil keduanya dijamin identik.
 */

export type TapType = 'CLOCK_IN' | 'CLOCK_OUT' | 'PRAYER' | 'OTHER';
export type PrayerSlot = 'DHUHA' | 'DHUHUR' | 'ASHAR';
export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALFA' | 'LIBUR';

export interface DailyState {
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lateMinutes: number;
  prayerDhuhaAt: Date | null;
  prayerDhuhurAt: Date | null;
  prayerAsharAt: Date | null;
}

export interface SchoolConfig {
  /** menit sejak 00:00, mis. 07:00 = 420 */
  startMinute: number;
  graceMinutes: number;
}

export const emptyDaily = (): DailyState => ({
  status: 'ALFA',
  checkInAt: null,
  checkOutAt: null,
  lateMinutes: 0,
  prayerDhuhaAt: null,
  prayerDhuhurAt: null,
  prayerAsharAt: null,
});

const minutesOfDay = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
};

export function applyTap(
  state: DailyState,
  tap: { tapType: TapType; prayerSlot: PrayerSlot | null; tappedAt: Date },
  config: SchoolConfig,
  timeZone: string,
): DailyState {
  const next: DailyState = { ...state };

  switch (tap.tapType) {
    case 'CLOCK_IN': {
      // Tap pertama yang menentukan. Tap berikutnya (mis. kembali dari sholat)
      // tidak boleh menimpa jam masuk.
      if (next.checkInAt === null) {
        next.checkInAt = tap.tappedAt;
        const threshold = config.startMinute + config.graceMinutes;
        const actual = minutesOfDay(tap.tappedAt, timeZone);
        const late = Math.max(0, actual - threshold);
        next.lateMinutes = late;
        next.status = late > 0 ? 'TERLAMBAT' : 'HADIR';
      }
      break;
    }
    case 'CLOCK_OUT': {
      next.checkOutAt = tap.tappedAt;
      break;
    }
    case 'PRAYER': {
      if (tap.prayerSlot === 'DHUHA' && next.prayerDhuhaAt === null) {
        next.prayerDhuhaAt = tap.tappedAt;
      } else if (tap.prayerSlot === 'DHUHUR' && next.prayerDhuhurAt === null) {
        next.prayerDhuhurAt = tap.tappedAt;
      } else if (tap.prayerSlot === 'ASHAR' && next.prayerAsharAt === null) {
        next.prayerAsharAt = tap.tappedAt;
      }
      break;
    }
    case 'OTHER':
    default:
      break;
  }

  return next;
}
