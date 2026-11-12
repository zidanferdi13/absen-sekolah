import { SettingsForm } from '@/components/settings-form';
import { PageHeader } from '@/components/ui/page-header';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Pengaturan"
        description="Jam masuk sekolah, toleransi keterlambatan, dan nama sekolah yang tampil di device."
      />
      <SettingsForm />
    </div>
  );
}
