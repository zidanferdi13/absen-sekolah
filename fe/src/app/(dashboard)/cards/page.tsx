import { CardManager } from '@/components/card-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function CardsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Kartu RFID"
        description="Terbitkan, assign ulang, atau nonaktifkan kartu. Satu orang hanya boleh punya satu kartu aktif — assign baru otomatis menonaktifkan kartu lama."
      />
      <CardManager />
    </div>
  );
}
