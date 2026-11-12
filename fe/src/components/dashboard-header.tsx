'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { findNavLabel } from '@/components/nav-config';
import { MobileNav } from '@/components/mobile-nav';
import { HeaderUser } from '@/components/header-user';
import { SchoolLogo } from '@/components/school-logo';

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

export function DashboardHeader() {
  const pathname = usePathname();

  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api.get<{ data: AcademicYear[] }>('/academic-years'),
    staleTime: 5 * 60_000,
  });

  const activeYear = years.data?.data.find((year) => year.isActive);
  const title = findNavLabel(pathname) ?? 'Dashboard';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav />
        <div className="hidden sm:block lg:hidden">
          <SchoolLogo size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-900">{title}</h1>
          {activeYear && <p className="truncate text-xs text-text-muted">{activeYear.name}</p>}
        </div>
      </div>
      <HeaderUser />
    </header>
  );
}
