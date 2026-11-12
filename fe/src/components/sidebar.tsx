import { SchoolLogo } from '@/components/school-logo';
import { SidebarNav } from '@/components/sidebar-nav';

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <SchoolLogo size={32} />
        <div className="leading-tight">
          <div className="text-sm font-semibold">TAPRES</div>
          <div className="text-2xs text-slate-400">Presensi RFID</div>
        </div>
      </div>
      <SidebarNav />
      <div className="border-t border-border p-4 text-2xs text-slate-400">
        v0.1.0 &middot; RFID 13.56 MHz
      </div>
    </aside>
  );
}
