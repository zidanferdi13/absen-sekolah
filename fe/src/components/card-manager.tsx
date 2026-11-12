'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CreditCard, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useCanWrite } from '@/components/auth-guard';

interface CardRow {
  id: string;
  uid: string;
  label: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'LOST';
  assignedAt: string | null;
  revokedAt: string | null;
  person: { id: string; fullName: string; nis: string | null; nip: string | null; type: string } | null;
}

interface PersonOption {
  id: string;
  fullName: string;
  nis: string | null;
  nip: string | null;
}

const statusTone: Record<string, 'success' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  LOST: 'danger',
};

const statusLabel: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Nonaktif',
  LOST: 'Hilang',
};

export function CardManager() {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite('OPERATOR');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [assigned, setAssigned] = useState('');

  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState('');
  const [label, setLabel] = useState('');
  const [personId, setPersonId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<CardRow | null>(null);

  const query = new URLSearchParams({ page: String(page), limit: '25' });
  if (search.trim()) query.set('q', search.trim());
  if (status) query.set('status', status);
  if (assigned) query.set('assigned', assigned);

  const list = useQuery({
    queryKey: ['cards', page, search, status, assigned],
    queryFn: () =>
      api.get<{ data: CardRow[]; meta: { page: number; limit: number; total: number } }>(
        `/cards?${query.toString()}`,
      ),
  });

  const people = useQuery({
    queryKey: ['person-options'],
    queryFn: async () => {
      const [students, teachers] = await Promise.all([
        api.get<{ data: PersonOption[] }>('/students?limit=200'),
        api.get<{ data: PersonOption[] }>('/teachers?limit=200'),
      ]);
      return [
        ...students.data.map((item) => ({ ...item, kind: 'Siswa' as const })),
        ...teachers.data.map((item) => ({ ...item, kind: 'Guru' as const })),
      ];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/cards', {
        uid: uid.trim(),
        label: label.trim() || undefined,
        personId: personId || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setUid('');
      setLabel('');
      setPersonId('');
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Gagal menerbitkan kartu'),
  });

  const revokeMutation = useMutation({
    mutationFn: (p: { id: string; status: 'INACTIVE' | 'LOST' }) =>
      api.post(`/cards/${p.id}/revoke`, { status: p.status }),
    onSuccess: () => {
      invalidate();
      setRevoking(null);
    },
  });

  const meta = list.data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari UID atau nama pemilik…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 pl-8"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Nonaktif</option>
          <option value="LOST">Hilang</option>
        </Select>

        <Select
          value={assigned}
          onChange={(event) => {
            setAssigned(event.target.value);
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">Semua kartu</option>
          <option value="true">Sudah ter-assign</option>
          <option value="false">Belum ter-assign</option>
        </Select>

        {canWrite && (
          <Button className="ml-auto" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Terbitkan Kartu
          </Button>
        )}
      </div>

      <TableShell>
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr>
              <Th>UID</Th>
              <Th>Label</Th>
              <Th>Pemilik</Th>
              <Th>Status</Th>
              <Th>Assign</Th>
              <Th className="text-right">Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={6} className="p-0">
                  <TableSkeleton rows={6} cols={6} />
                </td>
              </tr>
            )}

            {list.isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-rose-600">
                  Gagal memuat kartu.
                </td>
              </tr>
            )}

            {!list.isLoading && !list.isError && (list.data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState
                    icon={CreditCard}
                    title="Belum ada kartu terdaftar"
                    description="Terbitkan kartu baru, lalu tempelkan ke reader untuk mendapatkan UID-nya."
                    action={
                      canWrite ? (
                        <Button size="sm" onClick={() => setOpen(true)}>
                          <Plus className="h-3.5 w-3.5" />
                          Terbitkan Kartu
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}

            {list.data?.data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <Td className="font-mono text-xs font-medium">{row.uid}</Td>
                <Td className="text-slate-600">{row.label ?? '—'}</Td>
                <Td>
                  {row.person ? (
                    <div>
                      <div className="font-medium">{row.person.fullName}</div>
                      <div className="text-xs text-text-muted">
                        {row.person.type === 'STUDENT' ? 'Siswa' : 'Guru'} ·{' '}
                        {row.person.nis ?? row.person.nip ?? '—'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Belum ter-assign</span>
                  )}
                </Td>
                <Td>
                  <Badge tone={statusTone[row.status] ?? 'neutral'}>
                    {statusLabel[row.status] ?? row.status}
                  </Badge>
                </Td>
                <Td className="text-xs text-text-muted">
                  {row.assignedAt ? new Date(row.assignedAt).toLocaleDateString('id-ID') : '—'}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    {canWrite && row.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Nonaktifkan kartu ${row.uid}`}
                        onClick={() => setRevoking(row)}
                      >
                        <Ban className="h-3.5 w-3.5 text-rose-600" />
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-slate-100 sm:hidden">
          {list.isLoading && <TableSkeleton rows={4} cols={2} />}

          {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
            <li>
              <EmptyState
                icon={CreditCard}
                title="Belum ada kartu"
                description="Terbitkan kartu untuk mulai memakai absensi RFID."
              />
            </li>
          )}

          {list.data?.data.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-slate-900">{row.uid}</p>
                <p className="mt-0.5 truncate text-2xs text-text-muted">
                  {row.person ? row.person.fullName : 'Belum ter-assign'}
                  {row.label ? ` · ${row.label}` : ''}
                </p>
                <div className="mt-1.5">
                  <Badge tone={statusTone[row.status] ?? 'neutral'}>
                    {statusLabel[row.status] ?? row.status}
                  </Badge>
                </div>
              </div>
              {canWrite && row.status === 'ACTIVE' && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Nonaktifkan kartu ${row.uid}`}
                  onClick={() => setRevoking(row)}
                >
                  <Ban className="h-3.5 w-3.5 text-rose-600" />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {meta && (
          <Pagination page={page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
        )}
      </TableShell>

      <ConfirmDialog
        open={revoking !== null}
        title="Nonaktifkan kartu?"
        description={
          revoking ? `Kartu ${revoking.uid} tidak akan bisa dipakai tap sampai diaktifkan lagi.` : ''
        }
        confirmLabel="Nonaktifkan"
        pending={revokeMutation.isPending}
        onConfirm={() => {
          if (revoking) revokeMutation.mutate({ id: revoking.id, status: 'INACTIVE' });
        }}
        onClose={() => setRevoking(null)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Terbitkan Kartu RFID"
        description="Tempelkan kartu ke reader untuk mendapatkan UID, lalu masukkan di sini."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || uid.trim().length < 4}
            >
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="UID kartu" hint="Hex uppercase, contoh A1B2C3D4.">
            <Input
              value={uid}
              onChange={(event) => setUid(event.target.value)}
              placeholder="A1B2C3D4"
              className="font-mono uppercase"
            />
          </Field>

          <Field label="Label (opsional)">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Kartu cadangan"
            />
          </Field>

          <Field label="Pemilik (opsional)" hint="Bisa di-assign belakangan.">
            <Select value={personId} onChange={(event) => setPersonId(event.target.value)}>
              <option value="">Belum ter-assign</option>
              {people.data?.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.kind} · {person.fullName} ({person.nis ?? person.nip ?? '—'})
                </option>
              ))}
            </Select>
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
