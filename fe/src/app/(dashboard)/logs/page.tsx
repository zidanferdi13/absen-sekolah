import { LogManager } from '@/components/log-manager';

export default function LogsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Log Tap</h2>
        <p className="text-sm text-slate-500">
          Seluruh event tap, termasuk kartu tidak dikenal. Export mengikuti filter aktif.
        </p>
      </div>
      <LogManager />
    </div>
  );
}
