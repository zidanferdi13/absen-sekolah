import { AttendanceManager } from '@/components/attendance-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function AttendancePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Rekap Absensi"
        description="Rekap harian per kelas dan grid bulanan. Angka berasal dari rekap yang tersimpan — jalankan recompute bila log baru dikoreksi."
      />
      <AttendanceManager />
    </div>
  );
}
