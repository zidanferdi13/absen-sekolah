'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { SegmentedControl } from '@/components/ui/tabs';

interface DailyRow {
  personId: string;
  nis: string | null;
  nip: string | null;
  fullName: string;
  className: string | null;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  prayerDhuhaAt: string | null;
  prayerDhuhurAt: string | null;
  prayerAsharAt: string | null;
}

interface DailyResponse {
  data: DailyRow[];
  summary: Record<string, number>;
}

interface MonthlyRow {
  personId: string;
  fullName: string;
  className: string | null;
  days: Record<string, string>;
}

interface ClassOption {
  id: string;
  name: string;
}

const SUMMARY_ITEMS = [
  { key: 'hadir', label: 'Hadir', tone: 'text-emerald-600' },
  { key: 'terlambat', label: 'Terlambat', tone: 'text-amber-600' },
  { key: 'alfa', label: 'Alfa', tone: 'text-rose-600' },
  { key: 'izin', label: 'Izin', tone: 'text-sky-600' },
  { key: 'sakit', label: 'Sakit', tone: 'text-indigo-600' },
] as const;

const statusCell: Record<string, string> = {
  HADIR: 'bg-status-hadir/10 text-status-hadir',
  TERLAMBAT: 'bg-status-terlambat/10 text-status-terlambat',
  ALFA: 'bg-status-alfa/10 text-status-alfa',
  IZIN: 'bg-status-izin/10 text-status-izin',
  SAKIT: 'bg-status-sakit/10 text-status-sakit',
  LIBUR: 'bg-status-libur/10 text-status-libur',
};

const statusShort: Record<string, string> = {
  HADIR: 'H',
  TERLAMBAT: 'T',
  ALFA: 'A',
  IZIN: 'I',
  SAKIT: 'S',
  LIBUR: 'L',
};

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

function currentMonth(): string {
  return todayKey().slice(0, 7);
}

export function AttendanceManager() {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily');
  const [date, setDate] = useState(todayKey());
  const [month, setMonth] = useState(currentMonth());
  const [classId, setClassId] = useState('');

  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ data: ClassOption[] }>('/classes'),
  });

  const dailyParams = new URLSearchParams({ date });
  if (classId) dailyParams.set('classId', classId);

  const daily = useQuery({
    queryKey: ['attendance-daily', date, classId],
    queryFn: () => api.get<DailyResponse>(`/attendance/daily?${dailyParams.toString()}`),
    enabled: tab === 'daily',
  });

  const monthlyParams = new URLSearchParams({ month });
  if (classId) monthlyParams.set('classId', classId);

  const monthly = useQuery({
    queryKey: ['attendance-monthly', month, classId],
    queryFn: () => api.get<{ data: MonthlyRow[] }>(`/attendance/monthly?${monthlyParams.toString()}`),
    enabled: tab === 'monthly',
  });

  const daysInMonth = (() => {
    const [yearPart, monthPart] = month.split('-');
    return new Date(Number(yearPart), Number(monthPart), 0).getDate();
  })();

  return (
    <div className="space-y-4">
      <div
        data-print-hide
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="inline-flex rounded-md border border-slate-300 p-0.5">
          <SegmentedControl
            ariaLabel="Jenis rekap"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'daily', label: 'Harian' },
              { value: 'monthly', label: 'Bulanan' },
            ]}
            className="border-0"
          />
        </div>

        {tab === 'daily' ? (
          <Field label="Tanggal">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-40"
            />
          </Field>
        ) : (
          <Field label="Bulan">
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-40"
            />
          </Field>
        )}

        <Field label="Kelas">
          <Select value={classId} onChange={(event) => setClassId(event.target.value)} className="w-44">
            <option value="">Semua kelas</option>
            {classes.data?.data.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </Field>

        <Button
          variant="secondary"
          className="ml-auto"
          onClick={() => {
            if (tab === 'daily') void daily.refetch();
            else void monthly.refetch();
          }}
        >
          Muat ulang
        </Button>
      </div>

      {tab === 'daily' && (
        <>
          {daily.isLoading && <div className="text-sm text-slate-500">Memuat rekap…</div>}

          {daily.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Gagal memuat rekap harian.
            </div>
          )}

          {daily.data && (
            <>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {SUMMARY_ITEMS.map((item) => (
                  <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
                    <div className={`mt-1 text-2xl font-semibold ${item.tone}`}>
                      {daily.data.summary[item.key] ?? 0}
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">NIS/NIP</th>
                      <th className="px-4 py-3">Nama</th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Masuk</th>
                      <th className="px-4 py-3">Pulang</th>
                      <th className="px-4 py-3">Telat</th>
                      <th className="px-4 py-3">Sholat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {daily.data.data.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                          Tidak ada data pada filter ini.
                        </td>
                      </tr>
                    )}

                    {daily.data.data.map((row) => (
                      <tr key={row.personId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {row.nis ?? row.nip ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-medium">{row.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{row.className ?? '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.checkInAt
                            ? new Date(row.checkInAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.checkOutAt
                            ? new Date(row.checkOutAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {row.lateMinutes > 0 ? (
                            <span className="text-amber-600">{row.lateMinutes} mnt</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {row.prayerDhuhaAt && <Badge tone="success">Dhuha</Badge>}
                            {row.prayerDhuhurAt && <Badge tone="success">Dhuhur</Badge>}
                            {row.prayerAsharAt && <Badge tone="success">Ashar</Badge>}
                            {!row.prayerDhuhaAt && !row.prayerDhuhurAt && !row.prayerAsharAt && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'monthly' && (
        <>
          {monthly.isLoading && <div className="text-sm text-slate-500">Memuat rekap bulanan…</div>}

          {monthly.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Gagal memuat rekap bulanan.
            </div>
          )}

          {monthly.data && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print-color-exact">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">Kelas</th>
                    {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
                      <th key={day} className="px-1 py-2 text-center font-medium">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthly.data.data.length === 0 && (
                    <tr>
                      <td colSpan={daysInMonth + 2} className="px-4 py-8 text-center text-slate-500">
                        Belum ada data rekap bulan ini.
                      </td>
                    </tr>
                  )}

                  {monthly.data.data.map((row) => (
                    <tr key={row.personId} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium">
                        {row.fullName}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.className ?? '—'}</td>
                      {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                        const key = String(day).padStart(2, '0');
                        const status = row.days[key];
                        return (
                          <td key={day} className="px-1 py-2 text-center">
                            {status ? (
                              <span
                                title={status}
                                className={`inline-flex h-5 w-5 items-center justify-center rounded text-2xs font-semibold ${
                                  statusCell[status] ?? 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {statusShort[status] ?? '?'}
                              </span>
                            ) : (
                              <span className="text-slate-200">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {Object.entries(statusShort).map(([status, letter]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded text-2xs font-semibold ${
                    statusCell[status] ?? 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {letter}
                </span>
                {status}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
