import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <EmptyState
        icon={FileQuestion}
        title="Halaman tidak ditemukan"
        description="Alamat yang Anda buka tidak ada atau sudah dipindahkan."
        action={
          <Link href="/dashboard">
            <Button size="sm">Ke Dashboard</Button>
          </Link>
        }
      />
    </div>
  );
}
