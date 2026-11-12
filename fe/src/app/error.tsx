'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
        <AlertTriangle className="h-6 w-6 text-rose-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">Terjadi kesalahan</h2>
        <p className="mt-1 max-w-md text-sm text-text-muted">
          {error.message || 'Halaman gagal dimuat. Coba muat ulang atau kembali ke dashboard.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={reset}>
          Coba lagi
        </Button>
        <Link href="/dashboard">
          <Button>Ke Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
