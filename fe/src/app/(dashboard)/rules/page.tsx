import { RuleManager } from '@/components/rule-manager';
import { PageHeader } from '@/components/ui/page-header';

export default function RulesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Aturan Tap"
        description="Window waktu yang menentukan Clock In, Clock Out, dan tap sholat. Aturan scope kelas mengalahkan aturan global bila waktunya bertumpuk."
      />
      <RuleManager />
    </div>
  );
}
