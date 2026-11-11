import { DeviceManager } from '@/components/device-manager';

export default function DevicesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Perangkat</h2>
        <p className="text-sm text-slate-500">
          Device tap ESP32-S3. API key hanya ditampilkan sekali saat dibuat atau di-rotate.
        </p>
      </div>
      <DeviceManager />
    </div>
  );
}
