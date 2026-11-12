'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
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

export interface PersonRow {
  id: string;
  nis: string | null;
  nip: string | null;
  fullName: string;
  gender: string | null;
  phone: string | null;
  isActive: boolean;
  classId: string | null;
  className: string | null;
  cards: { id: string; uid: string; label: string | null; status: string }[];
}

interface ListResponse {
  data: PersonRow[];
  meta: { page: number; limit: number; total: number };
}

interface ClassOption {
  id: string;
  name: string;
}

type Mode = 'create' | 'edit';

interface FormState {
  fullName: string;
  gender: string;
  phone: string;
  classId: string;
  identifier: string;
  rfidUid: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  fullName: '',
  gender: '',
  phone: '',
  classId: '',
  identifier: '',
  rfidUid: '',
  isActive: true,
};

export function PersonManager({
  endpoint,
  type,
}: {
  endpoint: '/students' | '/teachers';
  type: 'STUDENT' | 'TEACHER';
}) {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite('OPERATOR');
  const canDelete = useCanWrite('ADMIN');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [classFilter, setClassFilter] = useState('');

  const [mode, setMode] = useState<Mode>('create');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PersonRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (search.trim()) query.set('q', search.trim());
  if (status) query.set('status', status);
  if (type === 'STUDENT' && classFilter) query.set('classId', classFilter);

  const list = useQuery({
    queryKey: [endpoint, page, search, status, classFilter],
    queryFn: () => api.get<ListResponse>(`${endpoint}?${query.toString()}`),
  });

  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ data: ClassOption[] }>('/classes'),
    enabled: type === 'STUDENT',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [endpoint] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const body: Record<string, unknown> = {
        fullName: payload.fullName.trim(),
        gender: payload.gender || undefined,
        phone: payload.phone.trim() || undefined,
      };

      if (type === 'STUDENT') body.nis = payload.identifier.trim();
      else body.nip = payload.identifier.trim();

      if (type === 'STUDENT' && payload.classId) body.classId = payload.classId;

      if (mode === 'create') {
        if (payload.rfidUid.trim()) body.rfidUid = payload.rfidUid.trim();
        return api.post(`${endpoint}`, body);
      }

      if (mode === 'edit') body.isActive = payload.isActive;
      return api.patch(`${endpoint}/${editing?.id}`, body);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan data');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof ApiError ? err.message : 'Gagal menghapus data');
    },
  });

  function openCreate() {
    setMode('create');
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: PersonRow) {
    setMode('edit');
    setEditing(row);
    setForm({
      fullName: row.fullName,
      gender: row.gender ?? '',
      phone: row.phone ?? '',
      classId: row.classId ?? '',
      identifier: row.nis ?? row.nip ?? '',
      rfidUid: '',
      isActive: row.isActive,
    });
    setFormError(null);
    setOpen(true);
  }

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;

  const identifierLabel = type === 'STUDENT' ? 'NIS' : 'NIP';
  const title = type === 'STUDENT' ? 'Data Siswa' : 'Data Guru';
  const columns = type === 'STUDENT' ? 6 : 5;

  const classOptions = useMemo(() => classes.data?.data ?? [], [classes.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder={`Cari nama atau ${identifierLabel}…`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-64 pl-8"
          />
        </div>

        {type === 'STUDENT' && (
          <Select
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">Semua kelas</option>
            {classOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="deleted">Terhapus</option>
          <option value="">Semua</option>
        </Select>

        {canWrite && (
          <Button onClick={openCreate} className="ml-auto">
            <Plus className="h-4 w-4" />
            Tambah {type === 'STUDENT' ? 'Siswa' : 'Guru'}
          </Button>
        )}
      </div>

      <TableShell>
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr>
              <Th>{identifierLabel}</Th>
              <Th>Nama</Th>
              {type === 'STUDENT' && <Th>Kelas</Th>}
              <Th>Kartu RFID</Th>
              <Th>Status</Th>
              <Th className="text-right">Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={columns} className="p-0">
                  <TableSkeleton rows={6} cols={columns} />
                </td>
              </tr>
            )}

            {list.isError && (
              <tr>
                <td colSpan={columns} className="px-4 py-8 text-center text-sm text-rose-600">
                  Gagal memuat data. {list.error instanceof ApiError ? list.error.message : ''}
                </td>
              </tr>
            )}

            {!list.isLoading && !list.isError && rows.length === 0 && (
              <tr>
                <td colSpan={columns} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={`Belum ada ${type === 'STUDENT' ? 'siswa' : 'guru'}`}
                    description="Data yang ditambahkan akan muncul di sini dan bisa langsung dipasangkan kartu RFID."
                    action={
                      canWrite ? (
                        <Button size="sm" onClick={openCreate}>
                          <Plus className="h-3.5 w-3.5" />
                          Tambah {type === 'STUDENT' ? 'Siswa' : 'Guru'}
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const activeCard = row.cards.find((card) => card.status === 'ACTIVE');
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs text-slate-600">{row.nis ?? row.nip ?? '—'}</Td>
                  <Td className="font-medium">{row.fullName}</Td>
                  {type === 'STUDENT' && <Td className="text-slate-600">{row.className ?? '—'}</Td>}
                  <Td>
                    {activeCard ? (
                      <Badge tone="info">{activeCard.uid}</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Belum ada</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>
                      {row.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah ${row.fullName}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Hapus ${row.fullName}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <ul className="divide-y divide-slate-100 sm:hidden">
          {list.isLoading && <TableSkeleton rows={4} cols={2} />}

          {!list.isLoading && rows.length === 0 && (
            <li>
              <EmptyState
                icon={Users}
                title={`Belum ada ${type === 'STUDENT' ? 'siswa' : 'guru'}`}
                description="Tambahkan data untuk mulai memakai absensi RFID."
              />
            </li>
          )}

          {rows.map((row) => {
            const activeCard = row.cards.find((card) => card.status === 'ACTIVE');
            return (
              <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{row.fullName}</p>
                  <p className="mt-0.5 font-mono text-2xs text-text-muted">
                    {row.nis ?? row.nip ?? '—'}
                    {type === 'STUDENT' && row.className ? ` · ${row.className}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>
                      {row.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                    {activeCard ? (
                      <Badge tone="info">{activeCard.uid}</Badge>
                    ) : (
                      <span className="text-2xs text-slate-400">Tanpa kartu</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(row)}
                      aria-label={`Ubah ${row.fullName}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${row.fullName}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(row);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {meta && (
          <Pagination page={page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
        )}
      </TableShell>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus data?"
        description={
          deleting
            ? `${deleting.fullName} akan dihapus (soft delete). Riwayat tap tetap tersimpan.`
            : ''
        }
        confirmLabel="Hapus"
        pending={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'create' ? `Tambah ${title}` : `Ubah ${title}`}
        description={
          mode === 'create'
            ? 'UID kartu opsional — bisa di-assign belakangan di menu Kartu RFID.'
            : 'Perubahan dicatat di audit log.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.fullName.trim() || !form.identifier.trim()}
            >
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nama lengkap">
            <Input
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Nama sesuai data sekolah"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={identifierLabel}>
              <Input
                value={form.identifier}
                onChange={(event) => setForm({ ...form, identifier: event.target.value })}
                placeholder={type === 'STUDENT' ? '2501001' : '198501012010011001'}
              />
            </Field>

            <Field label="Jenis kelamin">
              <Select
                value={form.gender}
                onChange={(event) => setForm({ ...form, gender: event.target.value })}
              >
                <option value="">—</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </Select>
            </Field>
          </div>

          {type === 'STUDENT' && (
            <Field label="Kelas">
              <Select
                value={form.classId}
                onChange={(event) => setForm({ ...form, classId: event.target.value })}
              >
                <option value="">Belum ditentukan</option>
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="No. HP (opsional)">
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="08xxxxxxxxxx"
              />
            </Field>

            {mode === 'create' ? (
              <Field label="UID kartu (opsional)" hint="Tap kartu ke reader untuk uji cepat.">
                <Input
                  value={form.rfidUid}
                  onChange={(event) => setForm({ ...form, rfidUid: event.target.value })}
                  placeholder="A1B2C3D4"
                  className="font-mono uppercase"
                />
              </Field>
            ) : (
              <Field label="Status keaktifan">
                <Select
                  value={form.isActive ? '1' : '0'}
                  onChange={(event) => setForm({ ...form, isActive: event.target.value === '1' })}
                >
                  <option value="1">Aktif</option>
                  <option value="0">Nonaktif</option>
                </Select>
              </Field>
            )}
          </div>

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
