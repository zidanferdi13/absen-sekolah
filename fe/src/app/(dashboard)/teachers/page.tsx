import { PersonManager } from '@/components/person-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function TeachersPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Guru"
        description="Master data guru beserta kartu RFID. Penghapusan bersifat soft delete."
      />
      <PersonManager endpoint="/teachers" type="TEACHER" />
    </div>
  );
}
