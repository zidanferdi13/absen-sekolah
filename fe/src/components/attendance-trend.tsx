'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDashboardFilter, withQuery } from '@/components/dashboard-filter';

interface TrendPoint {
  date: string;
  hadir: number;
  terlambat: number;
  alfa: number;
  izin: number;
  sakit: number;
  libur: number;
}

const SERIES = [
  { key: 'hadir', label: 'Hadir', color: '#10b981' },
  { key: 'terlambat', label: 'Terlambat', color: '#f59e0b' },
  { key: 'alfa', label: 'Alfa', color: '#f43f5e' },
] as const;

export function AttendanceTrend() {
  const { query, filter, days, from, to } = useDashboardFilter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-trend', query],
    queryFn: () => api.get<{ data: TrendPoint[] }>(withQuery('/dashboard/trend', query)),
    refetchInterval: 60_000,
  });

  const points = data?.data ?? [];
  const maxValue = Math.max(
    1,
    ...points.map((point) => Math.max(point.hadir, point.terlambat, point.alfa)),
  );

  const width = 100;
  const height = 40;

  const scopeLabel =
    filter === 'STUDENT' ? 'siswa' : filter === 'TEACHER' ? 'guru' : 'siswa dan guru';

  function line(key: 'hadir' | 'terlambat' | 'alfa') {
    if (points.length === 0) return '';
    return points
      .map((point, index) => {
        const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
        const y = height - (point[key] / maxValue) * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            Tren {days === 1 ? 'Harian' : `${days} Hari`}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Rekap harian {scopeLabel} · {from === to ? from : `${from} – ${to}`}
          </p>
        </div>
        <div className="flex gap-3">
          {SERIES.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {isLoading && <div className="mt-4 text-sm text-slate-500">Memuat grafik…</div>}

      {isError && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Gagal memuat tren kehadiran.
        </div>
      )}

      {!isLoading && !isError && points.length === 0 && (
        <div className="mt-4 flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
          Belum ada data rekap untuk rentang ini.
        </div>
      )}

      {points.length > 0 && (
        <>
          <svg
            viewBox={`0 0 ${width} ${height + 4}`}
            preserveAspectRatio="none"
            className="mt-4 h-56 w-full overflow-visible"
            role="img"
            aria-label="Grafik tren kehadiran 7 hari"
          >
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={0}
                x2={width}
                y1={height * ratio}
                y2={height * ratio}
                stroke="#e2e8f0"
                strokeWidth={0.3}
              />
            ))}
            {SERIES.map((item) => (
              <path
                key={item.key}
                d={line(item.key)}
                fill="none"
                stroke={item.color}
                strokeWidth={1.2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            {points.map((point) => (
              <span key={point.date}>
                {new Date(`${point.date}T00:00:00Z`).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
