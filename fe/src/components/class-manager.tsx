'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
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
    onSuccess: invalidate,
    onError: (err) => {
      window.alert(err instanceof ApiError ? err.message : 'Gagal menghapus kelas');
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Tingkat</th>
              <th className="px-4 py-3">Tahun Ajaran</th>
              <th className="px-4 py-3">Jumlah Siswa</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Memuat data…
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

            {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada kelas.
                </td>
              </tr>
            )}

            {list.data?.data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-slate-600">{row.level}</td>
                <td className="px-4 py-3 text-slate-600">{row.academicYearName}</td>
                <td className="px-4 py-3 text-slate-600">{row.studentCount}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Ubah">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Hapus"
                          onClick={() => {
                            if (window.confirm(`Hapus kelas ${row.name}?`)) {
                              deleteMutation.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
