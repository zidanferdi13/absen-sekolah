import Link from 'next/link';
import { SchoolLogo } from '@/components/school-logo';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  CreditCard,
  ScrollText,
  CalendarCheck,
  Cpu,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Siswa', icon: Users },
  { href: '/teachers', label: 'Guru', icon: GraduationCap },
  { href: '/classes', label: 'Kelas', icon: School },
  { href: '/cards', label: 'Kartu RFID', icon: CreditCard },
  { href: '/logs', label: 'Log Tap', icon: ScrollText },
  { href: '/attendance', label: 'Rekap Absensi', icon: CalendarCheck },
  { href: '/devices', label: 'Perangkat', icon: Cpu },
  { href: '/rules', label: 'Aturan Tap', icon: SlidersHorizontal },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
        <SchoolLogo size={32} />
        <div className="leading-tight">
          <div className="text-sm font-semibold">TAPRES</div>
          <div className="text-[10px] text-slate-400">Presensi RFID</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4 text-xs text-slate-400">
        v0.1.0 &middot; RFID 13.56 MHz
      </div>
    </aside>
  );
}
