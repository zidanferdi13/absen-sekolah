'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, type NavItem, type MinRole } from '@/components/nav-config';
import { useSession } from '@/components/auth-guard';

const ROLE_ORDER = ['VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;

function roleAllows(role: string | undefined, minRole?: MinRole): boolean {
  if (!minRole) return true;
  if (!role) return false;
  return ROLE_ORDER.indexOf(role as never) >= ROLE_ORDER.indexOf(minRole);
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Navigasi utama">
      {NAV_GROUPS.map((group) => {
        const items: NavItem[] = group.items.filter((item) => roleAllows(data?.role, item.minRole));
        if (items.length === 0) return null;

        return (
          <div key={group.title}>
            <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                        active
                          ? 'bg-brand-50 font-medium text-brand-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-500" />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
