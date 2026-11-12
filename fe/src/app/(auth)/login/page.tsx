'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, Wifi, Zap } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useBranding } from '@/components/school-logo';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'T';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branding = useBranding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const schoolName = branding.data?.schoolName ?? 'TAPRES';

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/login', { email, password });
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-col justify-between bg-brand-600 p-10 text-white lg:flex lg:w-1/2">
        <div className="flex items-center gap-3">
          {branding.data?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.data.logo}
              alt={`Logo ${schoolName}`}
              className="h-10 w-10 rounded-lg bg-white/10 object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
              {initials(schoolName)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">TAPRES</p>
            <p className="text-2xs text-white/70">Presensi RFID</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-2xl font-semibold leading-snug">
            Absensi sekolah yang tercatat otomatis dari satu tap kartu.
          </h1>
          <p className="mt-3 text-sm text-white/80">
            {schoolName} — rekap harian, kehadiran per kelas, dan kualitas tap dalam satu
            dashboard.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/90">
            <li className="flex items-center gap-3">
              <Zap className="h-4 w-4 shrink-0" />
              Tap kartu langsung tercatat tanpa input manual
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Rekap dihitung ulang dari log, bukan dari tebakan
            </li>
            <li className="flex items-center gap-3">
              <Wifi className="h-4 w-4 shrink-0" />
              Device tetap menyimpan tap saat jaringan putus
            </li>
          </ul>
        </div>

        <p className="text-2xs text-white/60">TAPRES v0.1.0 · RFID 13.56 MHz</p>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center gap-2 pb-2 text-center lg:hidden">
            {branding.data?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.data.logo}
                alt={`Logo ${schoolName}`}
                className="h-16 w-16 object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white">
                {initials(schoolName)}
              </div>
            )}
            <h2 className="text-base font-semibold text-slate-900">{schoolName}</h2>
            <p className="text-xs text-text-muted">Masuk ke dashboard TAPRES</p>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-lg font-semibold text-slate-900">Masuk</h2>
            <p className="mt-0.5 text-sm text-text-muted">
              Gunakan akun yang diberikan admin sekolah.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@sekolah.sch.id"
            />
          </Field>

          <Field label="Password">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-text-muted">
          Memuat…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
