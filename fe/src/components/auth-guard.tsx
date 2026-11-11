'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

const PUBLIC_PATHS = ['/login'];

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  });
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const { isLoading, isError } = useSession();

  useEffect(() => {
    if (isPublic) return;
    if (!isLoading && isError) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isError, isLoading, isPublic, pathname, router]);

  if (isPublic) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Memeriksa sesi…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Mengalihkan ke halaman login…
      </div>
    );
  }

  return <>{children}</>;
}

export function useCanWrite(minRole: 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN' = 'OPERATOR') {
  const { data } = useSession();
  if (!data) return false;

  const order = ['VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN'];
  return order.indexOf(data.role) >= order.indexOf(minRole);
}
