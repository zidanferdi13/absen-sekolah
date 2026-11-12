import {
  CalendarCheck,
  CreditCard,
  Cpu,
  GraduationCap,
  LayoutDashboard,
  School,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type MinRole = 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: MinRole;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operasional',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/logs', label: 'Log Tap', icon: ScrollText },
      { href: '/attendance', label: 'Rekap Absensi', icon: CalendarCheck },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { href: '/students', label: 'Siswa', icon: Users },
      { href: '/teachers', label: 'Guru', icon: GraduationCap },
      { href: '/classes', label: 'Kelas', icon: School },
      { href: '/cards', label: 'Kartu RFID', icon: CreditCard },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { href: '/devices', label: 'Perangkat', icon: Cpu, minRole: 'ADMIN' },
      { href: '/rules', label: 'Aturan Tap', icon: SlidersHorizontal, minRole: 'ADMIN' },
      { href: '/settings', label: 'Pengaturan', icon: Settings, minRole: 'ADMIN' },
    ],
  },
];

export function findNavLabel(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return item.label;
    }
  }
  return null;
}
