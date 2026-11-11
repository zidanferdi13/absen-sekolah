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
  fallbackLabel = 'A',
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

  return (
    <div
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white ${className}`}
    >
      {fallbackLabel}
    </div>
  );
}
