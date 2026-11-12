'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useDashboardFilter, withQuery } from '@/components/dashboard-filter';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendPoint {
  date: string;
  hadir: number;
  terlambat: number;
  alfa: number;
  izin: number;
  sakit: number;
  libur: number;
}

type SeriesKey = 'hadir' | 'terlambat' | 'alfa';

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'hadir', label: 'Hadir', color: '#059669' },
  { key: 'terlambat', label: 'Terlambat', color: '#d97706' },
  { key: 'alfa', label: 'Alfa', color: '#e11d48' },
];

const MAX_TREND_DAYS = 90;

function formatDay(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
}

export function AttendanceTrend() {
  const { query, filter, days, from, to } = useDashboardFilter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-trend', query],
    queryFn: () => api.get<{ data: TrendPoint[] }>(withQuery('/dashboard/trend', query)),
    refetchInterval: 60_000,
  });

  const points = data?.data ?? [];
  const scopeLabel =
    filter === 'STUDENT' ? 'siswa' : filter === 'TEACHER' ? 'guru' : 'siswa dan guru';

  const totals = points.reduce(
    (acc, point) => ({
      hadir: acc.hadir + point.hadir,
      terlambat: acc.terlambat + point.terlambat,
      alfa: acc.alfa + point.alfa,
    }),
    { hadir: 0, terlambat: 0, alfa: 0 },
  );

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        icon={TrendingUp}
        tone="brand"
        title={`Tren ${days === 1 ? 'Harian' : `${days} Hari`}`}
        description={`Rekap harian ${scopeLabel} · ${from === to ? from : `${from} – ${to}`}`}
        action={
          <div className="flex flex-wrap gap-3">
            {SERIES.map((item) => (
              <span key={item.key} className="flex items-center gap-1.5 text-2xs text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.label}</span>
                {!isLoading && points.length > 0 && (
                  <span className="tnum text-slate-400">{totals[item.key].toLocaleString('id-ID')}</span>
                )}
              </span>
            ))}
          </div>
        }
      />

      <CardBody>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Gagal memuat tren kehadiran.
          </div>
        )}

        {!isLoading && !isError && days > MAX_TREND_DAYS && (
          <EmptyState
            icon={TrendingUp}
            title="Rentang terlalu panjang untuk grafik"
            description={`Grafik tren dibatasi ${MAX_TREND_DAYS} hari. Perkecil rentang tanggal untuk melihat tren.`}
          />
        )}

        {!isLoading && !isError && days <= MAX_TREND_DAYS && points.length === 0 && (
          <EmptyState
            icon={TrendingUp}
            title="Belum ada data rekap"
            description="Jalankan recompute untuk rentang ini agar grafik terisi."
          />
        )}

        {!isLoading && !isError && days <= MAX_TREND_DAYS && points.length > 0 && (
          <div className="h-56 w-full" role="img" aria-label={`Tren kehadiran ${days} hari`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  {SERIES.map((item) => (
                    <linearGradient
                      key={item.key}
                      id={`trend-${item.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={item.color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  width={36}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(`${String(value)}T00:00:00Z`).toLocaleDateString('id-ID', {
                      dateStyle: 'medium',
                    })
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    boxShadow: '0 12px 32px -16px rgba(15,23,42,0.3)',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}
                />
                {SERIES.map((item) => (
                  <Area
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    name={item.label}
                    stroke={item.color}
                    strokeWidth={2}
                    fill={`url(#trend-${item.key})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
