# Redesign FE — Audit & Rencana Eksekusi

Status: **selesai (F1–F5)**. Diverifikasi dengan `npm run typecheck` dan `npx next build` (16 route) — keduanya hijau. Belum diuji manual di browser (375/768/1280), print preview, maupun `npm run lint` (repo ini belum punya konfigurasi ESLint).
Cakupan: seluruh `fe/src` (11 halaman + 20 komponen).
Dokumen ini adalah instruksi kerja untuk developer: setiap fase punya file target,
langkah, dan kriteria selesai yang bisa diverifikasi.

---

## 0. Aturan main sebelum mulai

1. Jangan mengubah logika bisnis, query key, payload API, atau `useCanWrite`.
   Pekerjaan ini **hanya** presentasi, struktur komponen, dan aksesibilitas.
2. Jangan menambah library UI baru. Stack tetap: Tailwind v4, `lucide-react`,
   `clsx` + `tailwind-merge` (sudah ada `cn()` di `src/lib/utils.ts`).
3. Urutan fase wajib: **F1 → F2 → F3 → F4 → F5**. F3+ bergantung pada primitif
   dari F1/F2. Jangan lompat ke halaman sebelum token dan primitif selesai.
4. Setelah setiap fase, jalankan:

   ```bash
   cd fe
   npm run typecheck
   npm run lint
   npm run build
   ```

   Fase dianggap selesai hanya bila ketiganya hijau.
5. Setiap fase adalah satu commit terpisah agar mudah di-review dan di-revert.

---

## 1. Ringkasan temuan audit

### P0 — rusak / memblokir pemakaian

| # | Temuan | Lokasi |
| --- | --- | --- |
| 1 | Tidak ada navigasi mobile. Sidebar `hidden lg:flex`, tanpa drawer/hamburger. Di bawah 1024px tidak ada cara pindah halaman. | `components/sidebar.tsx`, `app/(dashboard)/layout.tsx` |
| 2 | Sidebar tanpa active state — tidak ada `usePathname()`. | `components/sidebar.tsx` |
| 3 | Tidak ada focus indicator pada sidebar link, tab Harian/Bulanan, tombol date-range, tombol uploader, submit login. Gagal WCAG 2.4.7. | lihat F2 |
| 4 | Tabel terpotong: `overflow-hidden` tanpa `overflow-x-auto`. | `person-manager`, `card-manager`, `class-manager`, `device-manager`, `log-manager` |
| 5 | Tahun ajaran hardcoded `"Tahun Ajaran 2025/2026"` padahal API `academic-years` tersedia. | `app/(dashboard)/layout.tsx` |
| 6 | Login menulis input/tombol manual, tidak memakai `Input`/`Button`/`Field`; tanpa show-password; `useSearchParams` tanpa `<Suspense>` (risiko gagal build Next 15). | `app/(auth)/login/page.tsx` |

### P1 — inkonsistensi yang terlihat user

| # | Temuan | Lokasi |
| --- | --- | --- |
| 7 | Dua palet untuk status sama: `IZIN`/`SAKIT` biru di `badge.tsx`, tapi `sky`/`indigo` di `attendance-manager.tsx`. | `ui/badge.tsx`, `attendance-manager.tsx` |
| 8 | `window.confirm` / `window.alert` untuk aksi destruktif, padahal `Modal` sudah ada. | `person-manager.tsx`, `class-manager.tsx`, `card-manager.tsx` |
| 9 | Posisi tombol create tidak seragam: di baris filter (`ml-auto`) vs baris sendiri di atas tabel. | person/card vs class/device |
| 10 | Pagination tidak seragam: limit 20/25/50, hanya "Total X", tanpa nomor halaman / rentang. | semua manager |
| 11 | Duplikasi markup: string `rounded-xl border border-slate-200 bg-white p-5` dan `<thead className="bg-slate-50 …">` diulang 8×. Tidak ada `Card`, `Tabs`, `Table`, `EmptyState`, `Skeleton`. | semua |
| 12 | Radius tidak konsisten (`md`/`lg`/`xl`/`full`), tipografi mikro ad-hoc `text-[10px]`/`text-[11px]`. | semua |

### P2 — kualitas & polish

| # | Temuan | Lokasi |
| --- | --- | --- |
| 13 | Grafik tren `preserveAspectRatio="none"` → garis terdistorsi; label x `flex justify-between` meluber pada range panjang; tanpa sumbu Y/tooltip; `aria-label` hardcode "7 hari". | `attendance-trend.tsx` |
| 14 | `recharts` 2.15.4 terpasang dan ada di `package.json`, tapi tidak di-import di mana pun — dependency menganggur. | `fe/package.json` |
| 15 | File stub mati: `person-table.tsx`, `log-table.tsx` hanya `export {}`. Ada juga `person-table.deprecated.ts`. | `components/` |
| 16 | Filter dashboard hanya di state React; hilang saat refresh/back, tidak bisa di-share. | `dashboard-filter.tsx` |
| 17 | Menu tidak difilter per role: VIEWER tetap melihat Perangkat & Pengaturan lalu ditolak kotak kuning. | `sidebar.tsx`, `device-manager.tsx` |
| 18 | `RecentTaps` menampilkan `ACCEPTED`/`DUPLICATE` mentah, `LogManager` sudah punya label Indonesia. | `recent-taps.tsx` |
| 19 | Loading selalu teks "Memuat…"; empty state tanpa ikon/CTA. | semua |
| 20 | Tidak ada `@media print`, padahal rekap bulanan hampir pasti dicetak. | `globals.css`, `attendance-manager.tsx` |
| 21 | Fallback logo hardcoded huruf `"A"`, bukan inisial nama sekolah. | `school-logo.tsx`, `login/page.tsx` |
| 22 | Tidak ada `loading.tsx` / `error.tsx` / `not-found.tsx` di App Router. | `app/` |

---

## 2. Struktur file target

File baru yang harus dibuat:

```
fe/src/
  components/ui/
    card.tsx            # Card, CardHeader, CardBody, CardFooter
    table.tsx           # TableShell, Th, Td, SortableTh
    page-header.tsx     # PageHeader (judul + deskripsi + slot aksi)
    tabs.tsx            # SegmentedControl (ganti tab Harian/Bulanan)
    confirm-dialog.tsx  # ConfirmDialog berbasis Modal
    empty-state.tsx     # ikon + judul + deskripsi + CTA
    skeleton.tsx        # Skeleton, TableSkeleton, CardSkeleton
    pagination.tsx      # Pagination (prev/next + nomor + rentang)
  components/
    mobile-nav.tsx      # drawer + bottom-nav
    nav-config.ts       # satu sumber daftar menu + role minimum
  app/
    loading.tsx
    error.tsx
    not-found.tsx
```

File yang dihapus:

```
fe/src/components/person-table.tsx            # stub export {}
fe/src/components/log-table.tsx               # stub export {}
fe/src/components/person-table.deprecated.ts
```

> Catatan: pastikan dulu `person-table.tsx` tidak di-import di mana pun
> (`grep -r "person-table" fe/src`). Hasil audit saat ini: tidak ada pemakai.

---

## 3. FASE 1 — Design token & primitif

Tujuan: semua halaman berikutnya tidak lagi menulis warna/ukuran ad-hoc.

### 3.1 `app/globals.css`

Tambahkan token semantik di dalam blok `@theme` yang sudah ada (jangan hapus
`--color-brand-*`):

| Token | Nilai | Dipakai untuk |
| --- | --- | --- |
| `--color-surface` | `#ffffff` | latar card/tabel |
| `--color-canvas` | `#f8fafc` | latar aplikasi (`slate-50`) |
| `--color-border` | `#e2e8f0` | semua border |
| `--color-text-muted` | `#64748b` | teks sekunder |
| `--color-status-hadir` | `#059669` | hijau |
| `--color-status-terlambat` | `#d97706` | amber |
| `--color-status-alfa` | `#e11d48` | rose |
| `--color-status-izin` | `#0284c7` | sky |
| `--color-status-sakit` | `#4f46e5` | indigo |
| `--color-status-libur` | `#64748b` | slate |

Juga tambahkan:

- `--text-2xs: 0.6875rem` (11px) supaya tidak ada lagi `text-[11px]`.
- `body` memakai `bg-canvas text-slate-900`.
- Aturan global focus terlihat:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-brand-500);
    outline-offset: 2px;
  }
  ```
- Blok `@media print`: sembunyikan sidebar, header, toolbar filter; paksa
  tabel `attendance-manager` bulanan memakai warna latar (bukan hanya teks).

### 3.2 `ui/badge.tsx`

Ganti `toneClass` agar memakai token status. **Satu sumber warna** untuk
`Badge`, `StatusBadge`, `attendance-manager`, dan chart.

Ekspor tambahan:

```ts
export const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  ALFA: 'Alfa',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  LIBUR: 'Libur',
};

export const DECISION_LABEL: Record<string, string> = {
  ACCEPTED: 'Diterima',
  DUPLICATE: 'Duplikat',
  REJECTED: 'Ditolak',
  UNKNOWN_CARD: 'Kartu asing',
};
```

`attendance-manager.tsx` dan `recent-taps.tsx` **wajib** memakai konstanta ini,
bukan map lokal sendiri.

### 3.3 `ui/button.tsx`

Tambah varian `outline` (border + bg putih + hover canvas) dan ukuran `icon`
(`h-9 w-9 p-0`). Semua tombol ikon (Pencil, Trash2, Ban, LogOut) migrasi ke
`size="icon"` agar area sentuh ≥ 36px.

### 3.4 Primitif baru

| File | API minimum |
| --- | --- |
| `ui/card.tsx` | `<Card>`, `<CardHeader title description action>`, `<CardBody>`, `<CardFooter>` |
| `ui/table.tsx` | `<TableShell>` (wrapper `overflow-x-auto` + border + bg), `<Th>`, `<Td>` |
| `ui/page-header.tsx` | `<PageHeader title description actions>` |
| `ui/tabs.tsx` | `<SegmentedControl value onChange options>` dengan `role="tablist"` |
| `ui/confirm-dialog.tsx` | `<ConfirmDialog open title description confirmLabel tone onConfirm onClose>` |
| `ui/empty-state.tsx` | `<EmptyState icon title description action>` |
| `ui/skeleton.tsx` | `<Skeleton className>`, `<TableSkeleton rows cols>`, `<CardSkeleton />` |
| `ui/pagination.tsx` | `<Pagination page limit total onPageChange />` menampilkan `1–20 dari 145` + nomor halaman + prev/next |

**Kriteria selesai F1**
- Tidak ada lagi `text-[11px]` / `text-[10px]` di `src` (ganti `text-2xs`).
- Tidak ada palet status ganda (cek: hanya `badge.tsx` yang mendefinisikan warna status).
- `npm run typecheck && npm run lint && npm run build` hijau.

---

## 4. FASE 2 — App shell (P0 navigasi)

### 4.1 `components/nav-config.ts` (baru)

Satu sumber daftar menu, dipakai sidebar **dan** mobile nav:

```ts
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: 'VIEWER' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operasional',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/logs', label: 'Log Tap', icon: ScrollText, minRole: 'OPERATOR' },
      { href: '/attendance', label: 'Rekap Absensi', icon: CalendarCheck },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { href: '/students', label: 'Siswa', icon: Users },
      { href: '/teachers', label: 'Guru', icon: GraduationCap },
      { href: '/classes', label: 'Kelas', icon: School },
      { href: '/cards', label: 'Kartu RFID', icon: CreditCard },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { href: '/devices', label: 'Perangkat', icon: Cpu, minRole: 'ADMIN' },
      { href: '/rules', label: 'Aturan Tap', icon: SlidersHorizontal, minRole: 'ADMIN' },
      { href: '/settings', label: 'Pengaturan', icon: Settings, minRole: 'ADMIN' },
    ],
  },
];
```

Perbaiki #17 sekaligus: item dengan `minRole` tidak dirender untuk role di
bawahnya. Gunakan `useCanWrite` yang sudah ada (reuse, jangan buat checker baru).

### 4.2 `components/sidebar.tsx`

- Pakai `usePathname()`.
- Active state: item aktif mendapat `bg-brand-50 text-brand-700 font-medium`
  + indikator bar kiri (`before:` atau elemen `span` absolut, lebar 3px).
- Item non-aktif tetap `text-slate-600 hover:bg-slate-100`.
- `aria-current="page"` pada item aktif.
- Tambah `focus-visible:outline` (sudah otomatis dari token F1, tapi pastikan
  tidak di-`outline-none`).
- Ganti `lg:flex` tetap, tapi lebar `w-60` (dari 64) agar tidak terlalu lebar di laptop 1280px.

### 4.3 `components/mobile-nav.tsx` (baru)

Dua breakpoint perilaku:

| Lebar | Navigasi |
| --- | --- |
| `≥1024px` (lg) | Sidebar permanen |
| `<1024px` | Hamburger di header membuka drawer kiri (overlay + panel, tutup via Esc/backdrop) |

Implementasi drawer:
- Tombol hamburger di header, `aria-label="Buka menu"`, `aria-expanded`.
- Drawer: `fixed inset-y-0 left-0 z-50 w-72`, backdrop `bg-slate-900/40`.
- `document.body.style.overflow = 'hidden'` saat terbuka (pola sama dengan `Modal`).
- Tutup otomatis saat `pathname` berubah.
- Render daftar menu dari `NAV_GROUPS` (komponen `SidebarNav` dipakai ulang,
  bukan duplikat markup).

### 4.4 `app/(dashboard)/layout.tsx`

- Sidebar `hidden lg:flex`, tambah `<MobileNav />` (client component).
- Header: ganti judul statis menjadi judul per halaman (dari `usePathname()`
  → cari label di `NAV_GROUPS`), dan **hapus** "Tahun Ajaran 2025/2026".
- Tahun ajaran: ambil dari `GET /academic-years` (query `['academic-years']`,
  sudah dipakai di `classes/page.tsx` — reuse pola itu), tampilkan yang
  `isActive`. Bila gagal/kosong, sembunyikan baris itu (jangan tampilkan teks palsu).
- Header harus `sticky top-0 z-30 bg-white/95 backdrop-blur` agar filter tabel
  tidak menutupi header saat scroll.
- `<main>` beri `p-4 sm:p-6` (bukan `p-6` tetap) supaya tidak sempit di mobile.

**Kriteria selesai F2**
- Di lebar 375px, semua 10 halaman bisa dijangkau lewat drawer.
- Item aktif terlihat jelas dan `aria-current="page"` benar.
- VIEWER tidak melihat menu Perangkat/Aturan/Pengaturan.
- Tidak ada lagi string `2025/2026` di `src`.
- Build hijau.

---

## 5. FASE 3 — Halaman list (7 halaman)

Halaman: `/students`, `/teachers`, `/classes`, `/cards`, `/logs`, `/devices`, `/rules`.

### 5.1 Pola wajib setiap halaman

```
<PageHeader title description actions={tombolCreate} />
<Toolbar>  search + filter chips + reset            // satu baris, wrap di mobile
<TableShell>  tabel dengan overflow-x-auto + sticky header
<Pagination> 1–20 dari 145 · nomor halaman
```

Aturan konkret:

1. **Tombol create selalu di `PageHeader`, kanan atas.** Hapus pola `ml-auto`
   di baris filter dan hapus baris tombol terpisah di atas tabel
   (#9). Ini menyentuh `person-manager`, `card-manager`, `class-manager`,
   `device-manager`, `rule-manager`.
2. **Tabel wajib `overflow-x-auto`** (#4). Prioritas: `person-manager`,
   `card-manager`, `class-manager`, `device-manager`, `log-manager`.
   Jangan pakai `overflow-hidden` pada wrapper tabel.
3. **Mobile < 640px**: tabel diganti daftar kartu (satu kartu per baris:
   judul = nama, meta = kelas/UID, kanan = badge status + menu aksi).
   Terapkan minimal di `person-manager`, `card-manager`, `log-manager`.
   Tabel desktop tetap ada, hanya disembunyikan (`hidden sm:block`).
4. **Konfirmasi destruktif pakai `ConfirmDialog`** (#8). Ganti semua
   `window.confirm` dan `window.alert`:
   - `person-manager`: hapus siswa/guru
   - `class-manager`: hapus kelas (error hapus tampil di dalam dialog, bukan alert)
   - `card-manager`: nonaktifkan kartu
5. **Pagination seragam** memakai `<Pagination>` (#10). Standar limit: 20.
   `card-manager` yang sekarang 25 ikut jadi 20, `log-manager` yang 50 tetap
   50 (log memang padat) tapi tetap memakai komponen yang sama.
6. **Loading → `TableSkeleton`**, error tetap kotak rose di dalam `TableShell`,
   empty → `EmptyState` dengan CTA (mis. "Tambah Siswa") (#19).

### 5.2 `log-manager.tsx` spesifik

- Tombol "Export XLSX" saat ini `<a>` dengan kelas manual — ganti memakai
  `Button` yang dibungkus `<a>` (`asChild` tidak tersedia, jadi bungkus
  `<a className="contents">` atau beri `Button` varian `primary` via `className`).
  Yang penting: gaya sama dengan tombol primary lain dan punya focus ring.
- Baris `colSpan={8}` salah saat `canCorrect === false` (kolom hanya 7).
  Hitung colspan dinamis: `canCorrect ? 8 : 7`.
- Badge keputusan wajib memakai `DECISION_LABEL` dari F1 (#18).

### 5.3 `class-manager.tsx` spesifik

- Error hapus (`onError`) sekarang `window.alert`. Ubah jadi state
  `deleteError` yang ditampilkan di dalam `ConfirmDialog`.
- `academicYears` prop tetap; jangan ubah pemanggil di `classes/page.tsx`.

**Kriteria selesai F3**
- `grep -r "window.confirm\|window.alert" fe/src` → kosong.
- `grep -r "overflow-hidden rounded-xl" fe/src/components` → tidak ada wrapper tabel.
- Semua 7 halaman memakai `PageHeader` + `Pagination`.
- Uji manual: 375px, 768px, 1280px untuk tiap halaman.
- Build hijau.

---

## 6. FASE 4 — Dashboard & login

### 6.1 `app/(dashboard)/dashboard/page.tsx`

Susun ulang jadi grid bernapas (jarak antar seksi `space-y-6`, kartu `gap-4`):

1. `PageHeader` "Ringkasan Absensi" + filter (SegmentedControl orang + DateRangeFilter) di slot `actions`.
2. `StatsCards` — 4 KPI.
3. Baris 3: `RateCard` + `PopulationCard` + `TapQualityCard`, tinggi disamakan dengan `h-full`.
4. Baris 2/3 kolom: `AttendanceTrend` (span 2) + `RecentTaps`.
5. Baris: `ClassBreakdown` (span 2) + `PrayerCard`.

Jangan ubah `DashboardFilterProvider` maupun query key.

### 6.2 `attendance-trend.tsx` (#13, #14)

**Pakai `recharts`.** Dependency-nya sudah terpasang (`2.15.4`, peer `react ^19`)
sehingga tidak perlu install baru, dan ini sekaligus memakai dependency yang
selama ini menganggur (#14). Menulis grafik SVG manual berarti mengulang
pekerjaan yang sudah diselesaikan library (sumbu, tooltip, responsif).

Implementasi:
- Import `ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`,
  `CartesianGrid`, `Tooltip`, `Legend`.
- Ganti `AttendanceTrend` bagian `<svg>` dengan `ResponsiveContainer`
  tinggi `h-56` (jangan `preserveAspectRatio` — hilang otomatis).
- `XAxis` `dataKey="date"` dengan `tickFormatter` ke `dd MMM`, set
  `interval="preserveStartEnd"` dan `minTickGap={24}` agar label tidak
  bertumpuk pada range panjang.
- `YAxis` `allowDecimals={false}`, `width={32}`.
- `Tooltip` dengan `labelFormatter` tanggal Indonesia + nama seri Indonesia.
- `Legend` diganti ke bahasa Indonesia; hapus map `SERIES` custom tapi
  pertahankan `color` per seri.
- `aria-label` dinamis: `Tren kehadiran ${days} hari`.
- Bila `days > 90`, server sudah membatasi payload tren — tampilkan pesan
  `EmptyState` yang menjelaskan batas 90 hari, bukan grafik kosong.

Catatan: `recharts` adalah client-only. `attendance-trend.tsx` sudah `'use client'`,
pertahankan. Jangan mengimpor recharts di server component mana pun.

### 6.3 `recent-taps.tsx` (#18)

Pakai `DECISION_LABEL` untuk menampilkan teks Indonesia, bukan enum mentah.
Badge tetap memakai tone dari `badge.tsx`.

### 6.4 `app/(auth)/login/page.tsx` (#6, #21)

- Bungkus isi dengan `<Suspense fallback={...}>` karena `useSearchParams`
  dipakai — cegah build error Next 15.
- Layout dua kolom di `≥1024px`:
  - Kiri: panel brand (`bg-brand-600`, logo sekolah, satu kalimat nilai produk,
    daftar 3 poin singkat). Disembunyikan di mobile.
  - Kanan: kartu form `max-w-sm`, memakai `Field` + `Input` + `Button`.
- Tambah tombol show/hide password (`Eye`/`EyeOff`, `aria-label`, `aria-pressed`).
- Error login tampil sebagai alert inline di dalam kartu (bukan `<p>` telanjang),
  dan fokus otomatis ke field email saat error.
- Fallback logo memakai inisial nama sekolah (mis. "SMKN 2 Tanjung Raya" → "S2"),
  bukan huruf "A" (#21). Perbaiki juga di `school-logo.tsx`.

**Kriteria selesai F4**
- Login bisa dipakai di 375px tanpa horizontal scroll.
- Password bisa ditampilkan/disembunyikan via keyboard.
- Grafik tidak terdistorsi dan tidak meluber pada range 366 hari.
- `npm run build` hijau (bukti `Suspense` benar).

---

## 7. FASE 5 — Pembersihan & polish

### 7.1 Hapus kode mati (#15, #14)

| Aksi | File |
| --- | --- |
| Hapus | `components/person-table.tsx` (stub) |
| Hapus | `components/log-table.tsx` (stub) |
| Hapus | `components/person-table.deprecated.ts` |
| **Pertahankan** | `recharts` — sekarang dipakai di `attendance-trend.tsx` (F4). Jangan dihapus. |

Setelah menghapus, jalankan `npm install` agar lockfile ikut bersih.

### 7.2 Filter dashboard di URL (#16)

- `DashboardFilterProvider` membaca nilai awal dari `useSearchParams()`
  (`personType`, `from`, `to`) dan menulis balik via `router.replace`
  dengan `scroll: false`.
- Harus tetap memakai `Suspense` boundary di halaman dashboard.
- Perilaku default (tanpa param) tetap "hari ini / semua" agar tidak mengubah
  hasil yang diharapkan.

### 7.3 App Router states (#22)

- `app/loading.tsx`: skeleton shell (bukan teks "Memuat…").
- `app/error.tsx`: `'use client'`, tampilkan `reset()` + tombol kembali ke
  `/dashboard`.
- `app/not-found.tsx`: `EmptyState` + tombol ke dashboard.

### 7.4 Print (#20)

Di `globals.css` tambahkan:

```css
@media print {
  aside, header, [data-print-hide] { display: none !important; }
  main { padding: 0 !important; overflow: visible !important; }
  .print-break { break-inside: avoid; }
}
```

Lalu di `attendance-manager.tsx`:
- Toolbar filter & tab diberi `data-print-hide`.
- Grid bulanan: paksa `print-color-adjust: exact` agar huruf status (H/T/A/I/S/L)
  tetap berwarna saat dicetak.
- Tambah judul cetak: nama sekolah, bulan, kelas.

### 7.5 Aksesibilitas sisa

- Semua tombol ikon punya `aria-label`.
- `Modal`: tambahkan focus trap sederhana (fokus ke elemen pertama saat open,
  kembalikan fokus ke pemicu saat close) dan `aria-labelledby`.
- Pastikan kontras teks `text-slate-400` pada latar putih hanya dipakai untuk
  teks non-esensial (hint), bukan label penting.

**Kriteria selesai F5**
- `npm run typecheck && npm run lint && npm run build` hijau.
- `grep -r "recharts" fe/src` → **hanya** `attendance-trend.tsx`.
- Tidak ada file stub `export {}` tersisa.
- `npm run dev` → tidak ada error/warning di console untuk 11 halaman.
- Print preview rekap bulanan menampilkan tabel berwarna tanpa sidebar.

---

## 8. Checklist verifikasi akhir

Jalankan sebelum menyatakan redesign selesai:

```bash
cd fe
npm run typecheck
npm run lint
npm run build
grep -r "window.confirm\|window.alert" src            # harus kosong
grep -r "text-\[1[01]px\]" src                        # harus kosong
grep -rn "2025/2026" src                              # harus kosong
grep -rn "recharts" src                               # hanya attendance-trend.tsx
grep -rn "export {}" src                              # harus kosong
```

Uji manual di tiga lebar (375 / 768 / 1280):

| Skenario | Harapan |
| --- | --- |
| Buka `/dashboard` di 375px | Bisa buka drawer, pindah ke semua menu |
| Klik menu aktif | Ada indikator aktif, `aria-current` benar |
| Login sebagai VIEWER | Menu Perangkat/Aturan/Pengaturan tidak muncul |
| Tabel siswa di 375px | Berubah jadi kartu, tanpa scroll horizontal halaman |
| Hapus siswa | Muncul `ConfirmDialog`, bukan popup browser |
| Range tren 366 hari | Grafik bisa digeser, label tidak bertumpuk |
| Refresh dashboard dengan filter aktif | Filter tetap sama (dari URL) |
| Cetak rekap bulanan | Tanpa sidebar/header, huruf status berwarna |

---

## 9. Yang sengaja TIDAK dikerjakan

Agar ruang lingkup tidak melar:

- Tidak mengganti Tailwind v4 ke UI kit (shadcn/MUI). `PLAN.md` menyebut
  shadcn/ui, tetapi migrasi penuh di luar lingkup redesign ini.
- Tidak menyentuh `be/` maupun `uno/`.
- Tidak menambah dark mode (butuh keputusan desain terpisah).
- Tidak mengubah struktur data, endpoint, atau aturan otorisasi.
- Tidak menambah halaman baru.
