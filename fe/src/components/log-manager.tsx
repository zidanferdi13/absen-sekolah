'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ScrollText, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, DecisionBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
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
  const columns = canCorrect ? 8 : 7;

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

      <TableShell>
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr>
              <Th>Waktu</Th>
              <Th>UID</Th>
              <Th>Nama</Th>
              <Th>Kelas</Th>
              <Th>Tipe</Th>
              <Th>Keputusan</Th>
              <Th>Device</Th>
              {canCorrect && <Th className="text-right">Aksi</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={columns} className="p-0">
                  <TableSkeleton rows={8} cols={columns} />
                </td>
              </tr>
            )}

            {list.isError && (
              <tr>
                <td colSpan={columns} className="px-4 py-8 text-center text-sm text-rose-600">
                  Gagal memuat log.
                </td>
              </tr>
            )}

            {!list.isLoading && !list.isError && (list.data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={columns} className="p-0">
                  <EmptyState
                    icon={ScrollText}
                    title="Tidak ada log pada filter ini"
                    description="Coba longgarkan rentang tanggal atau hapus filter keputusan."
                  />
                </td>
              </tr>
            )}

            {list.data?.data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap text-slate-600">
                  {new Date(row.tappedAt).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </Td>
                <Td className="font-mono text-xs">{row.uid}</Td>
                <Td className="font-medium">{row.person?.name ?? '—'}</Td>
                <Td className="text-slate-600">{row.person?.className ?? '—'}</Td>
                <Td className="text-slate-600">
                  {row.tapType ? (tapLabel[row.tapType] ?? row.tapType) : '—'}
                  {row.prayerSlot ? ` · ${prayerLabel[row.prayerSlot] ?? row.prayerSlot}` : ''}
                </Td>
                <Td>
                  <DecisionBadge decision={row.decision} />
                </Td>
                <Td className="text-xs text-text-muted">{row.device.code}</Td>
                {canCorrect && (
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openCorrect(row)}>
                      Koreksi
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-slate-100 sm:hidden">
          {list.isLoading && <TableSkeleton rows={5} cols={2} />}

          {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
            <li>
              <EmptyState
                icon={ScrollText}
                title="Tidak ada log"
                description="Belum ada tap pada filter ini."
              />
            </li>
          )}

          {list.data?.data.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {row.person?.name ?? '(kartu tidak dikenal)'}
                  </p>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    {new Date(row.tappedAt).toLocaleString('id-ID', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {row.person?.className ? ` · ${row.person.className}` : ''}
                  </p>
                  <p className="mt-0.5 font-mono text-2xs text-slate-400">
                    {row.uid} · {row.device.code}
                  </p>
                </div>
                <DecisionBadge decision={row.decision} />
              </div>
              {canCorrect && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 -ml-2"
                  onClick={() => openCorrect(row)}
                >
                  Koreksi
                </Button>
              )}
            </li>
          ))}
        </ul>

        {meta && (
          <Pagination page={page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
        )}
      </TableShell>

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
