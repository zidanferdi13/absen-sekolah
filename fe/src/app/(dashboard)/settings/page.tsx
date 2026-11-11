import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan</h2>
        <p className="text-sm text-slate-500">
          Jam masuk sekolah, toleransi keterlambatan, dan nama sekolah yang tampil di device.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
