import { PersonManager } from '@/components/person-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function StudentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Siswa"
        description="Master data siswa beserta kartu RFID. Penghapusan bersifat soft delete."
      />
      <PersonManager endpoint="/students" type="STUDENT" />
    </div>
  );
}
