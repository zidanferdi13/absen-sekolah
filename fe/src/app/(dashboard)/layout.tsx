import { AuthGuard } from '@/components/auth-guard';
import { HeaderUser } from '@/components/header-user';
import { SchoolLogo } from '@/components/school-logo';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div className="flex items-center gap-3">
              <SchoolLogo size={28} />
              <div>
                <h1 className="text-sm font-semibold text-slate-900">Dashboard Absensi</h1>
                <p className="text-xs text-slate-500">Tahun Ajaran 2025/2026</p>
              </div>
            </div>
            <HeaderUser />
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
