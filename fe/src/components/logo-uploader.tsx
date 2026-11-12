'use client';

import { useRef, useState } from 'react';

const MAX_DIMENSION = 256;
const MAX_BYTES = 300 * 1024;

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error('Format harus PNG, JPEG, atau WebP.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak mendukung canvas.');

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.92;
  let dataUrl = canvas.toDataURL('image/webp', quality);

  while (dataUrl.length * 0.75 > MAX_BYTES && quality > 0.4) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/webp', quality);
  }

  if (dataUrl.length * 0.75 > MAX_BYTES) {
    throw new Error('Logo masih terlalu besar setelah dikompres. Gunakan gambar yang lebih sederhana.');
  }

  return dataUrl;
}

export function LogoUploader({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToLogoDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo sekolah" className="h-full w-full object-contain" />
          ) : (
            <span className="text-2xs text-slate-400">Belum ada</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? 'Memproses…' : value ? 'Ganti logo' : 'Pilih gambar'}
          </button>
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
            >
              Hapus
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        PNG/JPEG/WebP. Otomatis diperkecil ke 256px dan dikompres di browser.
      </p>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
