import { RuleManager } from '@/components/rule-manager';

export default function RulesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Aturan Tap</h2>
        <p className="text-sm text-slate-500">
          Window waktu yang menentukan Clock In, Clock Out, dan tap sholat. Aturan scope kelas
          mengalahkan aturan global bila waktunya bertumpuk.
        </p>
      </div>
      <RuleManager />
    </div>
  );
}
