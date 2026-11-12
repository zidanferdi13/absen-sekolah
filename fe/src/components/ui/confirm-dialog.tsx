'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Hapus',
  tone = 'danger',
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={pending}>
            {pending ? 'Memproses…' : confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      {!error && (
        <p className="text-sm text-slate-600">
          Tindakan ini tidak dapat dibatalkan dari antarmuka.
        </p>
      )}
    </Modal>
  );
}
