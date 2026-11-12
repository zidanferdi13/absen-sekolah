'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, UserX, Users, GraduationCap, Cpu } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDashboardFilter, withQuery } from '@/components/dashboard-filter';
import { Card } from '@/components/ui/card';

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
  {
    key: 'hadir',
    label: 'Hadir',
    hint: 'Termasuk terlambat',
    icon: CheckCircle2,
    accent: 'emerald',
  },
  {
    key: 'terlambat',
    label: 'Terlambat',
    hint: 'Lewat jam toleransi',
    icon: Clock3,
    accent: 'amber',
  },
  { key: 'alfa', label: 'Alfa', hint: 'Tanpa tap pada rentang ini', icon: UserX, accent: 'rose' },
  {
    key: 'totalTaps',
    label: 'Total Tap',
    hint: 'Semua percobaan tap',
    icon: Activity,
    accent: 'brand',
  },
] as const;

const accentStyles: Record<
  string,
  { tile: string; value: string; glow: string; bar: string }
> = {
  emerald: {
    tile: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    value: 'text-slate-900',
    glow: 'from-emerald-400/20',
    bar: 'bg-emerald-500',
  },
  amber: {
    tile: 'bg-amber-50 text-amber-600 ring-amber-100',
    value: 'text-slate-900',
    glow: 'from-amber-400/20',
    bar: 'bg-amber-500',
  },
  rose: {
    tile: 'bg-rose-50 text-rose-600 ring-rose-100',
    value: 'text-slate-900',
    glow: 'from-rose-400/20',
    bar: 'bg-rose-500',
  },
  brand: {
    tile: 'bg-brand-50 text-brand-600 ring-brand-100',
    value: 'text-slate-900',
    glow: 'from-brand-400/20',
    bar: 'bg-brand-500',
  },
};

export function StatsCards() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Gagal memuat statistik. Periksa koneksi ke backend.
      </div>
    );
  }

  const total = data ? data.hadir + data.terlambat + data.alfa : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {primary.map((card) => {
        const value = data?.[card.key] ?? 0;
        const style = accentStyles[card.accent];
        const Icon = card.icon;
        const share =
          card.key === 'totalTaps' || total === 0 ? null : Math.round((value / total) * 100);

        return (
          <Card key={card.key} interactive className="relative overflow-hidden p-5">
            <div
              className={cn(
                'pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl',
                style.glow,
              )}
              aria-hidden
            />
            <div className="relative flex items-start justify-between">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset',
                  style.tile,
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              {share !== null && !isLoading && (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                  {share}%
                </span>
              )}
            </div>

            <div className="relative mt-3">
              <div className={cn('tnum text-[28px] font-semibold leading-none tracking-tight', style.value)}>
                {isLoading ? '—' : value.toLocaleString('id-ID')}
              </div>
              <div className="mt-1.5 text-xs font-medium text-slate-600">{card.label}</div>
              <div className="mt-0.5 text-2xs text-slate-400">{card.hint}</div>
            </div>

            {share !== null && (
              <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full rounded-full transition-all', style.bar)}
                  style={{ width: `${Math.min(100, share)}%` }}
                />
              </div>
            )}
          </Card>
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
  const ringTone =
    rate >= 90
      ? 'stroke-emerald-500'
      : rate >= 75
        ? 'stroke-amber-500'
        : 'stroke-rose-500';
  const message =
    rate >= 90 ? 'Sangat baik' : rate >= 75 ? 'Perlu perhatian' : 'Di bawah target';

  return (
    <Card interactive className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
            <Activity className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Tingkat Kehadiran
          </h2>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset',
            rate >= 90
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
              : rate >= 75
                ? 'bg-amber-50 text-amber-700 ring-amber-100'
                : 'bg-rose-50 text-rose-700 ring-rose-100',
          )}
        >
          {isLoading ? '—' : message}
        </span>
      </div>

      <div className="flex flex-1 items-center gap-5 px-5 py-4">
        <div className="relative h-[76px] w-[76px] shrink-0">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              className="stroke-slate-100"
              strokeWidth="3.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${Math.min(100, rate)} 100`}
              pathLength={100}
              className={cn('transition-all duration-500', ringTone)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('tnum text-lg font-semibold leading-none', tone)}>
              {isLoading ? '—' : `${rate}`}
              <span className="text-xs">%</span>
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="tnum text-lg font-semibold text-slate-900">
              {isLoading ? '—' : present.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-text-muted">dari</span>
            <span className="tnum text-xs font-medium text-slate-600">
              {isLoading ? '—' : eligible.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="mt-0.5 text-2xs text-slate-400">orang-hari tercatat hadir</p>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${Math.min(100, rate)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PopulationCard() {
  const { data, isLoading } = useDashboardStats();
  const { filter } = useDashboardFilter();

  const items = [
    {
      label: 'Siswa',
      value: data?.totalStudents ?? 0,
      icon: Users,
      tile: 'bg-brand-50 text-brand-600 ring-brand-100',
      hidden: filter === 'TEACHER',
    },
    {
      label: 'Guru',
      value: data?.totalTeachers ?? 0,
      icon: GraduationCap,
      tile: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
      hidden: filter === 'STUDENT',
    },
    {
      label: 'Device aktif',
      value: data?.activeDevices ?? 0,
      icon: Cpu,
      tile: 'bg-slate-100 text-slate-600 ring-slate-200',
      hidden: false,
    },
  ].filter((item) => !item.hidden);

  return (
    <Card interactive className="flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
          <Users className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">Populasi</h2>
      </div>

      <div className="flex flex-1 items-center px-5 py-4">
        <div className="grid w-full gap-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                    item.tile,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-2xs text-text-muted">{item.label}</div>
                  <div className="tnum text-lg font-semibold leading-tight text-slate-900">
                    {isLoading ? '—' : item.value.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
