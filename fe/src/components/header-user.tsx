'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/components/auth-guard';

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
};

export function HeaderUser() {
  const router = useRouter();
  const { data } = useSession();

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-xs font-medium text-slate-800">{data?.name ?? '—'}</div>
        <div className="text-[11px] text-slate-500">
          {data ? (roleLabel[data.role] ?? data.role) : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        Keluar
      </button>
    </div>
  );
}
