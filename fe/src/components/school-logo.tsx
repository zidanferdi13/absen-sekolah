'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Branding {
  schoolName: string;
  logo: string | null;
}

export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: () => api.get<Branding>('/settings/branding'),
    staleTime: 5 * 60_000,
  });
}

export function SchoolLogo({
  size = 32,
  className = '',
  fallbackLabel,
}: {
  size?: number;
  className?: string;
  fallbackLabel?: string;
}) {
  const { data } = useBranding();

  if (data?.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data.logo}
        alt={`Logo ${data.schoolName}`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`object-contain ${className}`}
      />
    );
  }

  const source = data?.schoolName ?? 'TAPRES';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const derived =
    parts.length === 0
      ? 'T'
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : `${parts[0][0]}${parts[1][0]}`.toUpperCase();

  return (
    <div
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white ${className}`}
    >
      {fallbackLabel ?? derived}
    </div>
  );
}
