'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDashboardFilter, withQuery } from '@/components/dashboard-filter';
import { useDashboardStats } from '@/components/stats-cards';

const PRAYERS = [
  { key: 'dhuha', label: 'Dhuha', target: '09:30–10:15' },
  { key: 'dhuhur', label: 'Dhuhur', target: '11:45–12:45' },
  { key: 'ashar', label: 'Ashar', target: '15:00–15:45' },
] as const;

export function PrayerCard() {
  const { data, isLoading } = useDashboardStats();
  const { filter } = useDashboardFilter();

  const eligible = data?.eligiblePersons ?? 0;
  const prayer = data?.prayer;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold">Tap Sholat</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Jumlah yang tap di tiap slot hari ini
        {filter === 'STUDENT' ? ' (siswa)' : filter === 'TEACHER' ? ' (guru)' : ''}.
      </p>

      <div className="mt-4 space-y-3">
        {PRAYERS.map((item) => {
          const value = prayer?.[item.key] ?? 0;
          const percent = eligible > 0 ? Math.round((value / eligible) * 100) : 0;

          return (
            <div key={item.key}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="text-slate-500">
                  {isLoading ? '—' : `${value} orang · ${percent}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">Slot {item.target}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TapQualityCard() {
  const { data, isLoading } = useDashboardStats();
  const taps = data?.taps;

  const items = [
    { key: 'accepted', label: 'Diterima', tone: 'text-emerald-600' },
    { key: 'duplicate', label: 'Duplikat', tone: 'text-amber-600' },
    { key: 'rejected', label: 'Ditolak', tone: 'text-rose-600' },
    { key: 'unknownCard', label: 'Kartu asing', tone: 'text-slate-600' },
  ] as const;

  const total = taps ? taps.accepted + taps.duplicate + taps.rejected + taps.unknownCard : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold">Kualitas Tap Hari Ini</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Tap duplikat atau kartu asing menandakan masalah kartu atau reader.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className={`text-xl font-semibold ${item.tone}`}>
              {isLoading ? '—' : (taps?.[item.key] ?? 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-slate-400">
        Total {isLoading ? '—' : total.toLocaleString('id-ID')} percobaan tap
      </div>
    </section>
  );
}

interface ClassRow {
  classId: string;
  className: string;
  students: number;
  hadir: number;
  terlambat: number;
  alfa: number;
  attendanceRate: number;
}

export function ClassBreakdown() {
  const { query } = useDashboardFilter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-by-class', query],
    queryFn: () => api.get<{ data: ClassRow[]; totalStudents: number; workdays: number }>(
      withQuery('/dashboard/by-class', query),
    ),
    refetchInterval: 60_000,
  });

  const rows = data?.data ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold">Kehadiran per Kelas</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Khusus siswa{data && data.workdays > 1 ? ` · ${data.workdays} hari kerja` : ', hari ini'}.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {data ? `${data.totalStudents.toLocaleString('id-ID')} siswa` : ''}
        </span>
      </div>

      {isLoading && <div className="mt-4 text-sm text-slate-500">Memuat per kelas…</div>}

      {isError && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Gagal memuat data per kelas.
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="mt-4 text-xs text-slate-400">Belum ada kelas terdaftar.</div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {rows.map((row) => {
            const tone =
              row.attendanceRate >= 90
                ? 'bg-emerald-500'
                : row.attendanceRate >= 75
                  ? 'bg-amber-500'
                  : 'bg-rose-500';

            return (
              <div key={row.classId}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-700">{row.className}</span>
                  <span className="text-slate-500">
                    {row.attendanceRate}% · {row.hadir + row.terlambat}/{row.students}
                    {row.alfa > 0 && <span className="text-rose-500"> · {row.alfa} alfa</span>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${tone}`}
                    style={{ width: `${Math.min(100, row.attendanceRate)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
