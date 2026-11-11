import { env } from './env.js';

export const SCHOOL_TZ = env.SCHOOL_TIMEZONE;

/** "YYYY-MM-DD" pada zona waktu sekolah. */
export function toDateKey(date: Date, timeZone = SCHOOL_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Tanggal sebagai Date UTC pukul 00:00 untuk kolom `@db.Date`. */
export function toDateOnly(date: Date, timeZone = SCHOOL_TZ): Date {
  return new Date(`${toDateKey(date, timeZone)}T00:00:00.000Z`);
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
