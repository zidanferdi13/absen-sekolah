'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

export type PersonFilter = 'ALL' | 'STUDENT' | 'TEACHER';
export type RangePreset = 'today' | '7d' | '30d' | 'month' | 'custom';

const PERSON_OPTIONS: { value: PersonFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'STUDENT', label: 'Siswa' },
  { value: 'TEACHER', label: 'Guru' },
];

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
  { value: 'month', label: 'Bulan ini' },
];

const MAX_RANGE_DAYS = 366;

function toKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

function shift(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

function rangeForPreset(preset: RangePreset): { from: string; to: string } {
  const today = toKey(new Date());

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: shift(today, -6), to: today };
    case '30d':
      return { from: shift(today, -29), to: today };
    case 'month':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    default:
      return { from: today, to: today };
  }
}

interface FilterValue {
  filter: PersonFilter;
  setFilter: (next: PersonFilter) => void;
  preset: RangePreset;
  from: string;
  to: string;
  days: number;
  rangeError: string | null;
  applyPreset: (next: RangePreset) => void;
  setCustomRange: (from: string, to: string) => boolean;
  query: string;
}

const DashboardFilterContext = createContext<FilterValue | null>(null);

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<PersonFilter>('ALL');
  const [preset, setPreset] = useState<RangePreset>('today');
  const [range, setRange] = useState(() => rangeForPreset('today'));
  const [rangeError, setRangeError] = useState<string | null>(null);

  const days = diffDays(range.from, range.to);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filter !== 'ALL') params.set('personType', filter);
    params.set('from', range.from);
    params.set('to', range.to);
    return params.toString();
  }, [filter, range.from, range.to]);

  function applyPreset(next: RangePreset) {
    setPreset(next);
    setRangeError(null);
    if (next !== 'custom') setRange(rangeForPreset(next));
  }

  function setCustomRange(nextFrom: string, nextTo: string): boolean {
    setPreset('custom');

    if (!nextFrom || !nextTo) {
      setRangeError('Isi tanggal awal dan akhir.');
      return false;
    }

    if (nextFrom > nextTo) {
      setRangeError('Tanggal awal harus sebelum tanggal akhir.');
      return false;
    }

    const span = diffDays(nextFrom, nextTo);
    if (span > MAX_RANGE_DAYS) {
      setRangeError(`Rentang maksimum ${MAX_RANGE_DAYS} hari, dipilih ${span} hari.`);
      return false;
    }

    setRangeError(null);
    setRange({ from: nextFrom, to: nextTo });
    return true;
  }

  return (
    <DashboardFilterContext.Provider
      value={{
        filter,
        setFilter,
        preset,
        from: range.from,
        to: range.to,
        days,
        rangeError,
        applyPreset,
        setCustomRange,
        query,
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter(): FilterValue {
  const value = useContext(DashboardFilterContext);
  if (!value) throw new Error('useDashboardFilter harus dipakai di dalam DashboardFilterProvider');
  return value;
}

export function FilterToggle() {
  const { filter, setFilter } = useDashboardFilter();

  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {PERSON_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setFilter(option.value)}
          aria-pressed={filter === option.value}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            filter === option.value ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DateRangeFilter() {
  const { preset, from, to, days, rangeError, applyPreset, setCustomRange } = useDashboardFilter();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [localError, setLocalError] = useState<string | null>(null);

  const format = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('id-ID', { dateStyle: 'medium' });

  const label = from === to ? format(from) : `${format(from)} – ${format(to)}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setDraftFrom(from);
          setDraftTo(to);
          setLocalError(null);
          setOpen((value) => !value);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
        {label}
        {days > 1 && <span className="text-slate-400">· {days} hari</span>}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PRESETS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    applyPreset(item.value);
                    setOpen(false);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    preset === item.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">
                Dari
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(event) => setDraftFrom(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Sampai
                <input
                  type="date"
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
            </div>

            {(localError ?? rangeError) && (
              <p className="mt-2 text-xs text-rose-600">{localError ?? rangeError}</p>
            )}

            <button
              type="button"
              onClick={() => {
                const ok = setCustomRange(draftFrom, draftTo);
                if (ok) {
                  setLocalError(null);
                  setOpen(false);
                } else {
                  setLocalError(
                    draftFrom > draftTo
                      ? 'Tanggal awal harus sebelum tanggal akhir.'
                      : `Rentang maksimum ${MAX_RANGE_DAYS} hari.`,
                  );
                }
              }}
              className="mt-3 w-full rounded-md bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              Terapkan
            </button>

            <p className="mt-2 text-[11px] text-slate-400">Maksimum 366 hari.</p>
          </div>
        </>
      )}
    </div>
  );
}

export function withQuery(base: string, query: string): string {
  if (!query) return base;
  return base.includes('?') ? `${base}&${query}` : `${base}?${query}`;
}
