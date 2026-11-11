'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface LogRow {
  id: string;
  uid: string;
  person: { name: string; className: string | null } | null;
  tappedAt: string;
  tapType: string | null;
  decision: string;
}

const decisionTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACCEPTED: 'success',
  DUPLICATE: 'warning',
  REJECTED: 'danger',
  UNKNOWN_CARD: 'neutral',
};

const tapLabel: Record<string, string> = {
  CLOCK_IN: 'Masuk',
  CLOCK_OUT: 'Pulang',
  PRAYER: 'Sholat',
  OTHER: 'Lainnya',
};

export function RecentTaps() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recent-taps'],
    queryFn: () => api.get<{ data: LogRow[] }>('/logs?limit=8'),
    refetchInterval: 30_000,
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold">Tap Terakhir</h2>
      <p className="mt-0.5 text-xs text-slate-500">Diperbarui otomatis tiap 30 detik.</p>

      {isLoading && <div className="mt-4 text-sm text-slate-500">Memuat…</div>}

      {isError && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          Gagal memuat log.
        </div>
      )}

      {!isLoading && !isError && (data?.data.length ?? 0) === 0 && (
        <div className="mt-4 text-xs text-slate-400">Belum ada tap hari ini.</div>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {data?.data.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">
                {row.person?.name ?? '(kartu tidak dikenal)'}
              </div>
              <div className="text-[11px] text-slate-500">
                {new Date(row.tappedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {row.person?.className ? ` · ${row.person.className}` : ''}
                {row.tapType ? ` · ${tapLabel[row.tapType] ?? row.tapType}` : ''}
              </div>
            </div>
            <Badge tone={decisionTone[row.decision] ?? 'neutral'}>{row.decision}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
