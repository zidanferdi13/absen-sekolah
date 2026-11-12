import { DeviceManager } from '@/components/device-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function DevicesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Perangkat"
        description="Device tap ESP32-S3. API key hanya ditampilkan sekali saat dibuat atau di-rotate."
      />
      <DeviceManager />
    </div>
  );
}
