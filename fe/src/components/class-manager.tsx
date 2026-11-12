'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, School, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TableShell, Td, Th } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useCanWrite } from '@/components/auth-guard';

interface ClassRow {
  id: string;
  name: string;
  level: string;
  academicYearId: string;
  academicYearName: string;
  studentCount: number;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface FormState {
  name: string;
  level: string;
  academicYearId: string;
}

const emptyForm: FormState = { name: '', level: '', academicYearId: '' };

export function ClassManager({ academicYears }: { academicYears: AcademicYear[] }) {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite('ADMIN');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ data: ClassRow[] }>('/classes'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['classes'] });

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) =>
      editing
        ? api.patch(`/classes/${editing.id}`, payload)
        : api.post('/classes', payload),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan kelas');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof ApiError ? err.message : 'Gagal menghapus kelas');
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, academicYearId: academicYears[0]?.id ?? '' });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: ClassRow) {
    setEditing(row);
    setForm({ name: row.name, level: row.level, academicYearId: row.academicYearId });
    setFormError(null);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Kelas
          </Button>
        </div>
      )}

      <TableShell>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Kelas</Th>
              <Th>Tingkat</Th>
              <Th>Tahun Ajaran</Th>
              <Th>Jumlah Siswa</Th>
              <Th className="text-right">Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={5} className="p-0">
                  <TableSkeleton rows={4} cols={5} />
                </td>
              </tr>
            )}

            {list.isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-rose-600">
                  Gagal memuat kelas.
                </td>
              </tr>
            )}

            {!list.isLoading && !list.isError && (list.data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    icon={School}
                    title="Belum ada kelas"
                    description="Tambahkan kelas pada tahun ajaran aktif untuk mulai mengelompokkan siswa."
                    action={
                      canWrite ? (
                        <Button size="sm" onClick={openCreate}>
                          <Plus className="h-3.5 w-3.5" />
                          Tambah Kelas
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}

            {list.data?.data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <Td className="font-medium">{row.name}</Td>
                <Td className="text-slate-600">{row.level}</Td>
                <Td className="text-slate-600">{row.academicYearName}</Td>
                <Td className="text-slate-600">{row.studentCount}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah kelas ${row.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Hapus kelas ${row.name}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus kelas?"
        description={
          deleting
            ? `Kelas ${deleting.name} akan dihapus. Kelas yang masih punya siswa aktif tidak bisa dihapus.`
            : ''
        }
        confirmLabel="Hapus Kelas"
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
        title={editing ? 'Ubah Kelas' : 'Tambah Kelas'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={
                saveMutation.isPending || !form.name.trim() || !form.level.trim() || !form.academicYearId
              }
            >
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama kelas">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="7A"
              />
            </Field>

            <Field label="Tingkat">
              <Input
                value={form.level}
                onChange={(event) => setForm({ ...form, level: event.target.value })}
                placeholder="7"
              />
            </Field>
          </div>

          <Field label="Tahun ajaran">
            <Select
              value={form.academicYearId}
              onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}
              disabled={Boolean(editing)}
            >
              <option value="">Pilih tahun ajaran</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
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
