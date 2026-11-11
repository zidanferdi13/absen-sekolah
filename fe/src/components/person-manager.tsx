'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
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
    onSuccess: invalidate,
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{identifierLabel}</th>
              <th className="px-4 py-3">Nama</th>
              {type === 'STUDENT' && <th className="px-4 py-3">Kelas</th>}
              <th className="px-4 py-3">Kartu RFID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Memuat data…
                </td>
              </tr>
            )}

            {list.isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-rose-600">
                  Gagal memuat data. {list.error instanceof ApiError ? list.error.message : ''}
                </td>
              </tr>
            )}

            {!list.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data.
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const activeCard = row.cards.find((card) => card.status === 'ACTIVE');
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {row.nis ?? row.nip ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.fullName}</td>
                  {type === 'STUDENT' && (
                    <td className="px-4 py-3 text-slate-600">{row.className ?? '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    {activeCard ? (
                      <Badge tone="info">{activeCard.uid}</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Belum ada</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>
                      {row.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Ubah">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Hapus"
                          onClick={() => {
                            if (window.confirm(`Hapus ${row.fullName}? Riwayat tap tetap tersimpan.`)) {
                              deleteMutation.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {meta && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Total {meta.total} data
              {list.isFetching && ' · memuat…'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
              >
                Sebelumnya
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((value) => value + 1)}
                disabled={page * meta.limit >= meta.total}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

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
