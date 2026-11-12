'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TableShell, Td, Th } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useCanWrite } from '@/components/auth-guard';
import {
  DAY_LABELS,
  RuleFormModal,
  emptyRuleForm,
  toMinute,
  toTime,
  type RuleFormState,
} from '@/components/rule-form-modal';

interface RuleRow {
  id: string;
  name: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'PRAYER' | 'OTHER';
  prayerSlot: 'DHUHA' | 'DHUHUR' | 'ASHAR' | null;
  scope: 'GLOBAL' | 'CLASS' | 'PERSON';
  classId: string | null;
  className: string | null;
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  minGapMinutes: number;
  priority: number;
  isActive: boolean;
}

interface PreviewResult {
  person: { id: string; name: string } | null;
  local: { dayOfWeek: number; minuteOfDay: number; dateKey: string };
  decision: string;
  tapType: string | null;
  prayerSlot: string | null;
  reason: string | null;
  matchedRule: { id: string; name: string; scope: string } | null;
}

const typeLabel: Record<string, string> = {
  CLOCK_IN: 'Masuk',
  CLOCK_OUT: 'Pulang',
  PRAYER: 'Sholat',
  OTHER: 'Lainnya',
};

const slotLabel: Record<string, string> = {
  DHUHA: 'Dhuha',
  DHUHUR: 'Dhuhur',
  ASHAR: 'Ashar',
};

export function RuleManager() {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite('ADMIN');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyRuleForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RuleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUid, setPreviewUid] = useState('');
  const [previewAt, setPreviewAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['rules'],
    queryFn: () => api.get<{ data: RuleRow[] }>('/rules'),
  });

  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>('/classes'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rules'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        prayerSlot: form.type === 'PRAYER' ? form.prayerSlot : null,
        scope: form.scope,
        classId: form.scope === 'CLASS' ? form.classId || null : null,
        daysOfWeek: form.daysOfWeek,
        startMinute: toMinute(form.startTime),
        endMinute: toMinute(form.endTime),
        minGapMinutes: form.minGapMinutes,
        priority: form.priority,
        isActive: form.isActive,
      };
      return editing ? api.patch(`/rules/${editing.id}`, payload) : api.post('/rules', payload);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditing(null);
      setForm(emptyRuleForm);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan aturan'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rules/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof ApiError ? err.message : 'Gagal menghapus aturan');
    },
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      api.post<PreviewResult>('/rules/preview', {
        uid: previewUid.trim(),
        at: new Date(previewAt).toISOString(),
      }),
    onSuccess: (result) => {
      setPreview(result);
      setPreviewError(null);
    },
    onError: (err) => {
      setPreview(null);
      setPreviewError(err instanceof ApiError ? err.message : 'Gagal menjalankan uji tap');
    },
  });

  function openEdit(row: RuleRow) {
    setEditing(row);
    setForm({
      name: row.name,
      type: row.type,
      prayerSlot: row.prayerSlot ?? '',
      scope: row.scope === 'PERSON' ? 'GLOBAL' : row.scope,
      classId: row.classId ?? '',
      daysOfWeek: row.daysOfWeek,
      startTime: toTime(row.startMinute),
      endTime: toTime(row.endMinute),
      minGapMinutes: row.minGapMinutes,
      priority: row.priority,
      isActive: row.isActive,
    });
    setFormError(null);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setPreview(null);
            setPreviewError(null);
            setPreviewOpen(true);
          }}
        >
          <FlaskConical className="h-4 w-4" />
          Uji Tap
        </Button>
        {canWrite && (
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyRuleForm);
              setFormError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah Aturan
          </Button>
        )}
      </div>

      {list.isLoading && (
        <TableShell>
          <TableSkeleton rows={4} cols={6} />
        </TableShell>
      )}

      {list.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Gagal memuat aturan.
        </div>
      )}

      {list.data && (list.data.data.length === 0 ? (
        <TableShell>
          <EmptyState
            icon={FlaskConical}
            title="Belum ada aturan"
            description="Semua tap akan ditolak sampai minimal satu aturan dibuat."
            action={
              canWrite ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyRuleForm);
                    setFormError(null);
                    setOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Aturan
                </Button>
              ) : undefined
            }
          />
        </TableShell>
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Tipe</Th>
                <Th>Hari</Th>
                <Th>Jam</Th>
                <Th>Scope</Th>
                <Th>Pri.</Th>
                <Th>Status</Th>
                {canWrite && <Th className="text-right">Aksi</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.data.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-slate-600">
                    {typeLabel[row.type] ?? row.type}
                    {row.prayerSlot ? ` · ${slotLabel[row.prayerSlot] ?? row.prayerSlot}` : ''}
                  </Td>
                  <Td>
                    <div className="flex gap-0.5">
                      {DAY_LABELS.map((label, index) => (
                        <span
                          key={label}
                          className={`inline-flex h-5 w-6 items-center justify-center rounded text-2xs ${
                            row.daysOfWeek.includes(index)
                              ? 'bg-brand-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs text-slate-600">
                    {toTime(row.startMinute)}–{toTime(row.endMinute)}
                  </Td>
                  <Td className="text-slate-600">
                    {row.scope === 'GLOBAL' ? 'Global' : (row.className ?? 'Kelas')}
                  </Td>
                  <Td className="text-slate-600">{row.priority}</Td>
                  <Td>
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>
                      {row.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah aturan ${row.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Hapus aturan ${row.name}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ))}

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus aturan?"
        description={
          deleting
            ? `Aturan "${deleting.name}" akan dihapus. Tap yang sebelumnya cocok dengan aturan ini bisa berubah hasilnya setelah recompute.`
            : ''
        }
        confirmLabel="Hapus Aturan"
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

      <RuleFormModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing !== null}
        form={form}
        setForm={setForm}
        onSubmit={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        error={formError}
        classes={classes.data?.data ?? []}
      />

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Uji Tap (Dry Run)"
        description="Menguji aturan tanpa menyimpan log atau mengubah absensi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              Tutup
            </Button>
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending || previewUid.trim().length < 4}
            >
              {previewMutation.isPending ? 'Menguji…' : 'Jalankan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="UID kartu" hint="Tap kartu ke reader untuk melihat UID-nya di layar.">
            <Input
              value={previewUid}
              onChange={(event) => setPreviewUid(event.target.value)}
              placeholder="A0000001"
              className="font-mono uppercase"
            />
          </Field>

          <Field label="Waktu simulasi">
            <Input
              type="datetime-local"
              value={previewAt}
              onChange={(event) => setPreviewAt(event.target.value)}
            />
          </Field>

          {previewError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {previewError}
            </div>
          )}

          {preview && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Orang</span>
                <span className="font-medium">{preview.person?.name ?? 'Kartu tidak dikenal'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hari</span>
                <span className="font-medium">
                  {DAY_LABELS[preview.local.dayOfWeek]} · {preview.local.dateKey}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Menit ke-</span>
                <span className="font-mono">{preview.local.minuteOfDay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Keputusan</span>
                <Badge tone={preview.decision === 'ACCEPTED' ? 'success' : 'danger'}>
                  {preview.decision}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe tap</span>
                <span className="font-medium">{preview.tapType ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aturan cocok</span>
                <span className="font-medium">{preview.matchedRule?.name ?? '—'}</span>
              </div>
              {preview.reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Alasan</span>
                  <span className="font-medium text-rose-600">{preview.reason}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
