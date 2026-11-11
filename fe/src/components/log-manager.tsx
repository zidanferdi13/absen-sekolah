'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useCanWrite } from '@/components/auth-guard';

interface LogRow {
  id: string;
  uid: string;
  person: { name: string; nis: string | null; nip: string | null; className: string | null } | null;
  device: { code: string; name: string };
  tappedAt: string;
  tapType: string | null;
  prayerSlot: string | null;
  decision: string;
  reason: string | null;
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

const prayerLabel: Record<string, string> = {
  DHUHA: 'Dhuha',
  DHUHUR: 'Dhuhur',
  ASHAR: 'Ashar',
};

export function LogManager() {
  const queryClient = useQueryClient();
  const canCorrect = useCanWrite('ADMIN');

  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState('');
  const [tapType, setTapType] = useState('');

  const [editing, setEditing] = useState<LogRow | null>(null);
  const [newTapType, setNewTapType] = useState('CLOCK_IN');
  const [newSlot, setNewSlot] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (search.trim()) params.set('q', search.trim());
  if (decision) params.set('decision', decision);
  if (tapType) params.set('tapType', tapType);

  const list = useQuery({
    queryKey: ['logs', page, from, to, search, decision, tapType],
    queryFn: () =>
      api.get<{ data: LogRow[]; meta: { page: number; limit: number; total: number } }>(
        `/logs?${params.toString()}`,
      ),
  });

  const correctMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Tidak ada log dipilih');
      return api.patch(`/logs/${editing.id}`, {
        tapType: newTapType,
        prayerSlot: newTapType === 'PRAYER' ? newSlot || null : null,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-trend'] });
      setEditing(null);
      setReason('');
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan koreksi'),
  });

  const meta = list.data?.meta;

  function openCorrect(row: LogRow) {
    setEditing(row);
    setNewTapType(row.tapType ?? 'CLOCK_IN');
    setNewSlot(row.prayerSlot ?? '');
    setReason('');
    setFormError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <Field label="Dari">
          <Input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </Field>

        <Field label="Sampai">
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </Field>

        <Field label="Keputusan">
          <Select
            value={decision}
            onChange={(event) => {
              setDecision(event.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">Semua</option>
            <option value="ACCEPTED">Diterima</option>
            <option value="DUPLICATE">Duplikat</option>
            <option value="REJECTED">Ditolak</option>
            <option value="UNKNOWN_CARD">Kartu asing</option>
          </Select>
        </Field>

        <Field label="Tipe tap">
          <Select
            value={tapType}
            onChange={(event) => {
              setTapType(event.target.value);
              setPage(1);
            }}
            className="w-36"
          >
            <option value="">Semua</option>
            <option value="CLOCK_IN">Masuk</option>
            <option value="CLOCK_OUT">Pulang</option>
            <option value="PRAYER">Sholat</option>
            <option value="OTHER">Lainnya</option>
          </Select>
        </Field>

        <Field label="Cari">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Nama, NIS, UID…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-56 pl-8"
            />
          </div>
        </Field>

        <a
          href={`/api/v1/logs/export.xlsx?${params.toString()}`}
          className="ml-auto inline-flex items-center gap-2 rounded-md bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Download className="h-4 w-4" />
          Export XLSX
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">UID</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Keputusan</th>
              <th className="px-4 py-3">Device</th>
              {canCorrect && <th className="px-4 py-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Memuat log…
                </td>
              </tr>
            )}

            {list.isError && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-rose-600">
                  Gagal memuat log.
                </td>
              </tr>
            )}

            {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada log pada filter ini.
                </td>
              </tr>
            )}

            {list.data?.data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {new Date(row.tappedAt).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.uid}</td>
                <td className="px-4 py-3 font-medium">{row.person?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.person?.className ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.tapType ? (tapLabel[row.tapType] ?? row.tapType) : '—'}
                  {row.prayerSlot ? ` · ${prayerLabel[row.prayerSlot] ?? row.prayerSlot}` : ''}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={decisionTone[row.decision] ?? 'neutral'}>{row.decision}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.device.code}</td>
                {canCorrect && (
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openCorrect(row)}>
                      Koreksi
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {meta && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Total {meta.total} · halaman {meta.page}
              {list.isFetching && ' · memuat…'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * meta.limit >= meta.total}
                onClick={() => setPage((value) => value + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Koreksi Log Tap"
        description="Koreksi akan menulis audit log dan menghitung ulang rekap untuk hari tersebut."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              onClick={() => correctMutation.mutate()}
              disabled={correctMutation.isPending || reason.trim().length < 3}
            >
              {correctMutation.isPending ? 'Menyimpan…' : 'Simpan Koreksi'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {editing?.person?.name ?? '(kartu tidak dikenal)'} · {editing?.uid} ·{' '}
            {editing ? new Date(editing.tappedAt).toLocaleString('id-ID') : ''}
          </div>

          <Field label="Tipe tap">
            <Select value={newTapType} onChange={(event) => setNewTapType(event.target.value)}>
              <option value="CLOCK_IN">Masuk</option>
              <option value="CLOCK_OUT">Pulang</option>
              <option value="PRAYER">Sholat</option>
              <option value="OTHER">Lainnya</option>
            </Select>
          </Field>

          {newTapType === 'PRAYER' && (
            <Field label="Slot sholat">
              <Select value={newSlot} onChange={(event) => setNewSlot(event.target.value)}>
                <option value="">Pilih slot</option>
                <option value="DHUHA">Dhuha</option>
                <option value="DHUHUR">Dhuhur</option>
                <option value="ASHAR">Ashar</option>
              </Select>
            </Field>
          )}

          <Field label="Alasan koreksi" hint="Minimal 3 karakter, tersimpan di audit log.">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: salah tap, siswa memakai kartu teman"
            />
          </Field>

          {formError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
