'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DecisionBadge } from '@/components/ui/badge';
import { Activity, ScrollText } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LogRow {
  id: string;
  uid: string;
  person: { name: string; className: string | null } | null;
  tappedAt: string;
  tapType: string | null;
  decision: string;
}

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

  const rows = data?.data ?? [];
  const accepted = rows.filter((row) => row.decision === 'ACCEPTED').length;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Activity}
        tone="emerald"
        title="Tap Terakhir"
        description="Diperbarui otomatis tiap 30 detik."
        action={
          !isLoading && rows.length > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {accepted}/{rows.length} valid
            </span>
          ) : undefined
        }
      />

      <CardBody className="flex-1 pt-4">
        {isLoading && <TableSkeleton rows={5} cols={2} />}

        {isError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            Gagal memuat log.
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title="Belum ada tap"
            description="Tap kartu ke reader untuk melihat aktivitas di sini."
          />
        )}

        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const initials = (row.person?.name ?? '?')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase();

            const acceptedRow = row.decision === 'ACCEPTED';

            return (
              <li key={row.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ring-1 ring-inset',
                    acceptedRow
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                      : 'bg-slate-100 text-slate-500 ring-slate-200',
                  )}
                >
                  {row.person ? initials : '?'}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">
                    {row.person?.name ?? '(kartu tidak dikenal)'}
                  </div>
                  <div className="truncate text-2xs text-text-muted">
                    {new Date(row.tappedAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {row.person?.className ? ` · ${row.person.className}` : ''}
                    {row.tapType ? ` · ${tapLabel[row.tapType] ?? row.tapType}` : ''}
                  </div>
                </div>

                <DecisionBadge decision={row.decision} />
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
