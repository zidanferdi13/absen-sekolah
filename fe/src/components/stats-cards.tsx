'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDashboardFilter, withQuery } from '@/components/dashboard-filter';

export interface DashboardStats {
  date: string | null;
  from: string;
  to: string;
  days: number;
  workdays: number;
  personType: string | null;
  totalStudents: number;
  totalTeachers: number;
  eligiblePersons: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
  libur: number;
  attendanceRate: number;
  totalTaps: number;
  activeDevices: number;
  taps: { accepted: number; duplicate: number; rejected: number; unknownCard: number };
  prayer: { dhuha: number; dhuhur: number; ashar: number };
}

export function useDashboardStats() {
  const { query } = useDashboardFilter();
  return useQuery({
    queryKey: ['dashboard-stats', query],
    queryFn: () => api.get<DashboardStats>(withQuery('/dashboard/stats', query)),
    refetchInterval: 30_000,
  });
}

const primary = [
  { key: 'hadir', label: 'Hadir', tone: 'text-emerald-600', hint: 'Termasuk terlambat' },
  { key: 'terlambat', label: 'Terlambat', tone: 'text-amber-600', hint: 'Lewat jam toleransi' },
  { key: 'alfa', label: 'Alfa', tone: 'text-rose-600', hint: 'Tanpa tap pada rentang ini' },
  { key: 'totalTaps', label: 'Total Tap', tone: 'text-brand-600', hint: 'Semua percobaan tap' },
] as const;

export function StatsCards() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Gagal memuat statistik. Periksa koneksi ke backend.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {primary.map((card) => {
        const value = data?.[card.key] ?? 0;
        return (
          <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {card.label}
            </div>
            <div className={`mt-2 text-3xl font-semibold ${card.tone}`}>
              {isLoading ? '—' : value.toLocaleString('id-ID')}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{card.hint}</div>
          </div>
        );
      })}
    </div>
  );
}

export function RateCard() {
  const { data, isLoading } = useDashboardStats();

  const rate = data?.attendanceRate ?? 0;
  const eligible = data?.eligiblePersons ?? 0;
  const present = (data?.hadir ?? 0) + (data?.terlambat ?? 0);

  const tone = rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-amber-600' : 'text-rose-600';
  const barColor = rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Tingkat Kehadiran
        </div>
        <div className={`text-xl font-semibold ${tone}`}>{isLoading ? '—' : `${rate}%`}</div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        {isLoading
          ? 'Memuat…'
          : `${present.toLocaleString('id-ID')} dari ${eligible.toLocaleString('id-ID')} orang-hari`}
      </div>
    </div>
  );
}

export function PopulationCard() {
  const { data, isLoading } = useDashboardStats();
  const { filter } = useDashboardFilter();

  const items = [
    {
      label: 'Siswa',
      value: data?.totalStudents ?? 0,
      tone: 'text-brand-600',
      hidden: filter === 'TEACHER',
    },
    {
      label: 'Guru',
      value: data?.totalTeachers ?? 0,
      tone: 'text-indigo-600',
      hidden: filter === 'STUDENT',
    },
    { label: 'Device aktif', value: data?.activeDevices ?? 0, tone: 'text-slate-700', hidden: false },
  ].filter((item) => !item.hidden);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Populasi</div>
      <div className="mt-3 flex gap-6">
        {items.map((item) => (
          <div key={item.label}>
            <div className={`text-2xl font-semibold ${item.tone}`}>
              {isLoading ? '—' : item.value.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
