import { AttendanceManager } from '@/components/attendance-manager';

export default function AttendancePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Rekap Absensi</h2>
        <p className="text-sm text-slate-500">
          Rekap harian per kelas dan grid bulanan. Angka berasal dari rekap yang tersimpan —
          jalankan recompute bila log baru dikoreksi.
        </p>
      </div>
      <AttendanceManager />
    </div>
  );
}
