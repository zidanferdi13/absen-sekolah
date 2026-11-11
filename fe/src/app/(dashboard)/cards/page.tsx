import { CardManager } from '@/components/card-manager';

export default function CardsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Kartu RFID</h2>
        <p className="text-sm text-slate-500">
          Terbitkan, assign ulang, atau nonaktifkan kartu. Satu orang hanya boleh punya satu kartu
          aktif — assign baru otomatis menonaktifkan kartu lama.
        </p>
      </div>
      <CardManager />
    </div>
  );
}
