import { PersonManager } from '@/components/person-manager';

export default function TeachersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Data Guru</h2>
        <p className="text-sm text-slate-500">
          Master data guru beserta kartu RFID. Penghapusan bersifat soft delete.
        </p>
      </div>
      <PersonManager endpoint="/teachers" type="TEACHER" />
    </div>
  );
}
