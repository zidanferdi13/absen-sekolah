'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ClassManager } from '@/components/class-manager';

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

export default function ClassesPage() {
  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api.get<{ data: AcademicYear[] }>('/academic-years'),
  });

  const list = years.data?.data ?? [];
  const preferred = list.find((year) => year.isActive) ?? list[0];
  const options = preferred
    ? [preferred, ...list.filter((year) => year.id !== preferred.id)]
    : list;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Kelas</h2>
        <p className="text-sm text-slate-500">
          Daftar kelas pada tahun ajaran. Kelas yang masih punya siswa aktif tidak bisa dihapus.
        </p>
      </div>

      {years.isLoading && <div className="text-sm text-slate-500">Memuat tahun ajaran…</div>}

      {years.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Gagal memuat tahun ajaran.
        </div>
      )}

      {!years.isLoading && list.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Belum ada tahun ajaran. Buat tahun ajaran terlebih dahulu sebelum menambah kelas.
        </div>
      )}

      {options.length > 0 && <ClassManager academicYears={options} />}
    </div>
  );
}
