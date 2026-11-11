import { PersonManager } from '@/components/person-manager';

export default function StudentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Data Siswa</h2>
        <p className="text-sm text-slate-500">
          Master data siswa beserta kartu RFID. Penghapusan bersifat soft delete.
        </p>
      </div>
      <PersonManager endpoint="/students" type="STUDENT" />
    </div>
  );
}
