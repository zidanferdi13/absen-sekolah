'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { LogoUploader } from '@/components/logo-uploader';
import { useCanWrite } from '@/components/auth-guard';

const toTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

const toMinute = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
};

export function SettingsForm() {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite('ADMIN');

  const [schoolName, setSchoolName] = useState('');
  const [logo, setLogo] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [graceMinutes, setGraceMinutes] = useState('15');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ data: Record<string, string> }>('/settings'),
  });

  useEffect(() => {
    const data = query.data?.data;
    if (!data) return;
    setSchoolName(data['school.name'] ?? '');
    setLogo(data['school.logo'] ?? '');
    setStartTime(toTime(Number(data['school.startMinute'] ?? 420)));
    setGraceMinutes(data['school.graceMinutes'] ?? '15');
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/settings', {
        settings: [
          { key: 'school.name', value: schoolName.trim() },
          { key: 'school.logo', value: logo },
          { key: 'school.startMinute', value: String(toMinute(startTime)) },
          { key: 'school.graceMinutes', value: String(Number(graceMinutes)) },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setMessage('Pengaturan tersimpan.');
      setError(null);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan');
    },
  });

  if (query.isLoading) return <div className="text-sm text-slate-500">Memuat pengaturan…</div>;

  if (query.isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Gagal memuat pengaturan.
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <Field label="Logo sekolah">
        <LogoUploader value={logo} onChange={setLogo} disabled={!canWrite} />
      </Field>

      <Field label="Nama sekolah">
        <Input
          value={schoolName}
          onChange={(event) => setSchoolName(event.target.value)}
          disabled={!canWrite}
          placeholder="SMKN 2 Tanjung Raya"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jam masuk sekolah">
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            disabled={!canWrite}
          />
        </Field>

        <Field label="Toleransi keterlambatan (menit)" hint="Clock in setelah jam ini dianggap terlambat.">
          <Input
            type="number"
            min={0}
            max={120}
            value={graceMinutes}
            onChange={(event) => setGraceMinutes(event.target.value)}
            disabled={!canWrite}
          />
        </Field>
      </div>

      <p className="text-xs text-slate-500">
        Perubahan berlaku untuk perhitungan berikutnya. Jalankan recompute untuk menghitung ulang
        rekap tanggal yang sudah lewat.
      </p>

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {canWrite && (
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}
        </Button>
      )}
    </div>
  );
}
