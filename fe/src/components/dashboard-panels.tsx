'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDashboardFilter, withQuery } from '@/components/dashboard-filter';
import { useDashboardStats } from '@/components/stats-cards';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CheckCircle2,
  Copy,
  Moon,
  ShieldAlert,
  TriangleAlert,
  Users,
  UserX,
} from 'lucide-react';

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
    <Card className="flex flex-col">
      <CardHeader
        icon={Moon}
        tone="brand"
        title="Tap Sholat"
        description={`Jumlah yang tap di tiap slot hari ini${
          filter === 'STUDENT' ? ' (siswa)' : filter === 'TEACHER' ? ' (guru)' : ''
        }.`}
      />

      <CardBody className="flex-1 space-y-4 pt-4">
        {PRAYERS.map((item) => {
          const value = prayer?.[item.key] ?? 0;
          const percent = eligible > 0 ? Math.round((value / eligible) * 100) : 0;

          return (
            <div key={item.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  {item.label}
                  <span className="text-2xs font-normal text-slate-400">{item.target}</span>
                </span>
                <span className="tnum text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{isLoading ? '—' : value}</span>
                  {!isLoading && <span className="text-slate-400"> · {percent}%</span>}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

export function TapQualityCard() {
  const { data, isLoading } = useDashboardStats();
  const taps = data?.taps;

  const items = [
    {
      key: 'accepted',
      label: 'Diterima',
      icon: CheckCircle2,
      iconTone: 'text-emerald-600',
      value: 'text-slate-900',
    },
    {
      key: 'duplicate',
      label: 'Duplikat',
      icon: Copy,
      iconTone: 'text-amber-600',
      value: 'text-slate-900',
    },
    {
      key: 'rejected',
      label: 'Ditolak',
      icon: ShieldAlert,
      iconTone: 'text-rose-600',
      value: 'text-slate-900',
    },
    {
      key: 'unknownCard',
      label: 'Kartu asing',
      icon: UserX,
      iconTone: 'text-slate-500',
      value: 'text-slate-900',
    },
  ] as const;

  const total = taps ? taps.accepted + taps.duplicate + taps.rejected + taps.unknownCard : 0;
  const acceptRate = total > 0 ? Math.round((taps!.accepted / total) * 100) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={TriangleAlert}
        tone="amber"
        title="Kualitas Tap Hari Ini"
        description="Duplikat atau kartu asing menandakan masalah kartu atau reader."
        action={
          !isLoading && total > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
              {acceptRate}% valid
            </span>
          ) : undefined
        }
      />

      <CardBody className="flex-1 pt-4">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', item.iconTone)} />
                  <span className="text-2xs text-text-muted">{item.label}</span>
                </div>
                <div className={cn('tnum mt-1.5 text-xl font-semibold leading-none', item.value)}>
                  {isLoading ? '—' : (taps?.[item.key] ?? 0).toLocaleString('id-ID')}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-2xs text-slate-400">
          <span>Total percobaan tap</span>
          <span className="tnum font-medium text-slate-600">
            {isLoading ? '—' : total.toLocaleString('id-ID')}
          </span>
        </div>
      </CardBody>
    </Card>
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
    <Card className="lg:col-span-2">
      <CardHeader
        icon={Users}
        tone="brand"
        title="Kehadiran per Kelas"
        description={`Khusus siswa${
          data && data.workdays > 1 ? ` · ${data.workdays} hari kerja` : ', hari ini'
        }.`}
        action={
          data ? (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-2xs text-slate-500 ring-1 ring-inset ring-slate-200">
              {data.totalStudents.toLocaleString('id-ID')} siswa
            </span>
          ) : undefined
        }
      />

      <CardBody className="pt-4">
        {isLoading && <TableSkeleton rows={4} cols={2} />}

        {isError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Gagal memuat data per kelas.
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            icon={Users}
            title="Belum ada kelas terdaftar"
            description="Tambahkan kelas dan siswa agar kehadiran per kelas terisi."
          />
        )}

        {rows.length > 0 && (
          <div className="space-y-3.5">
            {rows.map((row) => {
              const barTone =
                row.attendanceRate >= 90
                  ? 'bg-emerald-500'
                  : row.attendanceRate >= 75
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
              const pillTone =
                row.attendanceRate >= 90
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                  : row.attendanceRate >= 75
                    ? 'bg-amber-50 text-amber-700 ring-amber-100'
                    : 'bg-rose-50 text-rose-700 ring-rose-100';

              return (
                <div key={row.classId}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 px-1 text-2xs font-semibold text-slate-600">
                        {row.className.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-700">
                        {row.className}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-2xs text-slate-500">
                        {row.hadir + row.terlambat}/{row.students}
                      </span>
                      {row.alfa > 0 && (
                        <span className="tnum rounded-full bg-rose-50 px-1.5 py-0.5 text-2xs font-medium text-rose-600 ring-1 ring-inset ring-rose-100">
                          {row.alfa} alfa
                        </span>
                      )}
                      <span
                        className={cn(
                          'tnum rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ring-inset',
                          pillTone,
                        )}
                      >
                        {row.attendanceRate}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barTone)}
                      style={{ width: `${Math.min(100, row.attendanceRate)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
