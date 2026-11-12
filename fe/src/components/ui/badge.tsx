import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-100',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  ALFA: 'Alfa',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  LIBUR: 'Libur',
};

export const DECISION_LABEL: Record<string, string> = {
  ACCEPTED: 'Diterima',
  DUPLICATE: 'Duplikat',
  REJECTED: 'Ditolak',
  UNKNOWN_CARD: 'Kartu asing',
};

const statusTone: Record<string, Tone> = {
  HADIR: 'success',
  TERLAMBAT: 'warning',
  ALFA: 'danger',
  IZIN: 'info',
  SAKIT: 'info',
  LIBUR: 'neutral',
};

const statusCellTone: Record<string, string> = {
  HADIR: 'bg-status-hadir/10 text-status-hadir',
  TERLAMBAT: 'bg-status-terlambat/10 text-status-terlambat',
  ALFA: 'bg-status-alfa/10 text-status-alfa',
  IZIN: 'bg-status-izin/10 text-status-izin',
  SAKIT: 'bg-status-sakit/10 text-status-sakit',
  LIBUR: 'bg-status-libur/10 text-status-libur',
};

export const STATUS_CELL_CLASS = statusCellTone;

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function DecisionBadge({ decision }: { decision: string }) {
  const tone =
    decision === 'ACCEPTED'
      ? 'success'
      : decision === 'DUPLICATE'
        ? 'warning'
        : decision === 'REJECTED'
          ? 'danger'
          : 'neutral';

  return <Badge tone={tone}>{DECISION_LABEL[decision] ?? decision}</Badge>;
}
