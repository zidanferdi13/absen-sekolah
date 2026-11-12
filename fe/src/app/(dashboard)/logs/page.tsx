import { LogManager } from '@/components/log-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function LogsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Log Tap"
        description="Seluruh event tap, termasuk kartu tidak dikenal. Export mengikuti filter aktif."
      />
      <LogManager />
    </div>
  );
}
