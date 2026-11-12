'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useCanWrite } from '@/components/auth-guard';

interface DeviceRow {
  id: string;
  code: string;
  name: string;
  location: string | null;
  status: 'ACTIVE' | 'DISABLED' | 'MAINTENANCE';
  firmwareVersion: string | null;
  ipAddress: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

const statusTone: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  MAINTENANCE: 'warning',
  DISABLED: 'neutral',
};

const statusLabel: Record<string, string> = {
  ACTIVE: 'Aktif',
  MAINTENANCE: 'Perbaikan',
  DISABLED: 'Nonaktif',
};

function relativeTime(value: string | null): string {
  if (!value) return 'Belum pernah';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export function DeviceManager() {
  const queryClient = useQueryClient();
  const canManage = useCanWrite('ADMIN');

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [revealed, setRevealed] = useState<{ code: string; apiKey: string } | null>(null);
  const [rotating, setRotating] = useState<DeviceRow | null>(null);

  const list = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<{ data: DeviceRow[] }>('/devices'),
    enabled: canManage,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['devices'] });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<{ code: string; apiKey: string }>('/devices', {
        code: code.trim(),
        name: name.trim(),
        location: location.trim() || undefined,
      }),
    onSuccess: (result) => {
      invalidate();
      setOpen(false);
      setCode('');
      setName('');
      setLocation('');
      setFormError(null);
      setRevealed({ code: result.code, apiKey: result.apiKey });
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Gagal menambah device'),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ code: string; apiKey: string }>(`/devices/${id}/rotate-key`),
    onSuccess: (result) => {
      invalidate();
      setRevealed({ code: result.code, apiKey: result.apiKey });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (p: { id: string; status: DeviceRow['status'] }) =>
      api.patch(`/devices/${p.id}`, { status: p.status }),
    onSuccess: invalidate,
  });

  if (!canManage) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Halaman ini hanya untuk Admin dan Super Admin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah Device
        </Button>
      </div>

      {list.isLoading && <div className="text-sm text-slate-500">Memuat device…</div>}

      {list.isLoading && (
        <TableShell>
          <TableSkeleton rows={4} cols={5} />
        </TableShell>
      )}

      {list.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Gagal memuat device.
        </div>
      )}

      {list.data && (list.data.data.length === 0 ? (
        <TableShell>
          <EmptyState
            icon={KeyRound}
            title="Belum ada device terdaftar"
            description="Tambahkan device ESP32-S3 lalu salin API key-nya ke firmware."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Tambah Device
              </Button>
            }
          />
        </TableShell>
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Nama</Th>
                <Th>Lokasi</Th>
                <Th>Status</Th>
                <Th>Firmware</Th>
                <Th>Terakhir aktif</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.data.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs font-medium">{row.code}</Td>
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-slate-600">{row.location ?? '—'}</Td>
                  <Td>
                    <Badge tone={statusTone[row.status] ?? 'neutral'}>
                      {statusLabel[row.status] ?? row.status}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-text-muted">{row.firmwareVersion ?? '—'}</Td>
                  <Td className="text-xs text-text-muted">{relativeTime(row.lastSeenAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Select
                        value={row.status}
                        onChange={(event) =>
                          statusMutation.mutate({
                            id: row.id,
                            status: event.target.value as DeviceRow['status'],
                          })
                        }
                        className="w-32 !py-1 text-xs"
                      >
                        <option value="ACTIVE">Aktif</option>
                        <option value="MAINTENANCE">Perbaikan</option>
                        <option value="DISABLED">Nonaktif</option>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rotate API key ${row.code}`}
                        onClick={() => setRotating(row)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ))}

      <ConfirmDialog
        open={rotating !== null}
        title="Rotate API key?"
        description={
          rotating
            ? `Device ${rotating.code} tidak akan bisa mengirim tap sampai API key baru dipasang di firmware.`
            : ''
        }
        confirmLabel="Rotate Key"
        pending={rotateMutation.isPending}
        onConfirm={() => {
          if (rotating) rotateMutation.mutate(rotating.id);
        }}
        onClose={() => setRotating(null)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tambah Device"
        description="API key hanya ditampilkan sekali setelah device dibuat."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !code.trim() || !name.trim()}
            >
              {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Kode device" hint="Huruf, angka, underscore, atau strip. Contoh GATE-01.">
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="GATE-01" />
          </Field>

          <Field label="Nama">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Gerbang Utama"
            />
          </Field>

          <Field label="Lokasi (opsional)">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Lobi sekolah"
            />
          </Field>

          {formError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={revealed !== null}
        onClose={() => setRevealed(null)}
        title="API Key Device"
        description="Salin sekarang. Key ini tidak dapat ditampilkan lagi."
        footer={
          <Button onClick={() => setRevealed(null)}>Sudah saya simpan</Button>
        }
      >
        <div className="space-y-3">
          <Field label="Kode device">
            <Input value={revealed?.code ?? ''} readOnly className="font-mono" />
          </Field>
          <Field label="API key">
            <Input value={revealed?.apiKey ?? ''} readOnly className="font-mono text-xs" />
          </Field>
          <p className="text-xs text-slate-500">
            Masukkan key ini ke firmware sebagai <code>deviceKey</code> (NVS).
          </p>
        </div>
      </Modal>
    </div>
  );
}
