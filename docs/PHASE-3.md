# Phase 3 — Frontend Core

Status: **selesai** (kode). Belum dijalankan di browser.

## File baru / diubah

| File | Isi |
| --- | --- |
| `fe/src/lib/api.ts` | Refresh-token interceptor otomatis saat 401 |
| `fe/src/components/auth-guard.tsx` | `AuthGuard`, `useSession`, `useCanWrite` |
| `fe/src/components/header-user.tsx` | Nama, role, tombol keluar |
| `fe/src/components/ui/button.tsx` | Varian primary/secondary/danger/ghost |
| `fe/src/components/ui/field.tsx` | `Input`, `Select`, `Field` |
| `fe/src/components/ui/modal.tsx` | Dialog dengan Esc + scroll lock |
| `fe/src/components/person-manager.tsx` | CRUD siswa & guru (dipakai 2 halaman) |
| `fe/src/components/class-manager.tsx` | CRUD kelas |
| `fe/src/components/attendance-trend.tsx` | Grafik tren 7 hari (SVG, tanpa library chart) |
| `fe/src/components/recent-taps.tsx` | Tap terakhir, polling 30 detik |
| `fe/src/app/(dashboard)/layout.tsx` | Dibungkus `AuthGuard` + header user |
| `be/src/modules/attendance/routes.ts` | Tambah `GET /dashboard/trend` |
| `be/src/modules/master/academic-years.routes.ts` | `GET`/`POST /academic-years` |

## Keputusan desain

### Grafik pakai SVG langsung, bukan Recharts
`recharts` tetap ada di `package.json` tapi tidak dipakai untuk tren ini.
Alasannya: kebutuhan hanya 3 garis pada 7 titik. SVG ~60 baris, tanpa
`ResponsiveContainer` yang butuh `ResizeObserver`, dan tidak menambah bundle
~100 KB. Recharts bisa dipakai nanti bila butuh tooltip interaktif.

### Refresh token ditangani di layer `fetch`, bukan di komponen
Interceptor 401 ada di `api.ts`: satu kali refresh, lalu request diulang.
Ada guard `refreshing` agar 5 request paralel yang gagal bersamaan hanya
memicu **satu** panggilan `/auth/refresh`, bukan lima.

### Satu komponen `PersonManager` untuk siswa dan guru
Perbedaan siswa/guru hanya: label identifier (NIS vs NIP), field kelas, dan
endpoint. Menduplikasi komponen akan membuat bug CRUD harus diperbaiki dua kali.

### `/classes` butuh tahun ajaran, jadi dibuat endpoint `academic-years`
`ClassManager` sebelumnya saya rencanakan memakai konstanta ID palsu. Itu akan
membuat tombol "Tambah Kelas" gagal di database sungguhan. Endpoint
`/academic-years` ditambahkan supaya halaman kelas mengambil ID nyata, dan
halaman menampilkan peringatan bila belum ada tahun ajaran.

### RBAC di UI bersifat kosmetik
`useCanWrite()` hanya menyembunyikan tombol. Otorisasi sebenarnya tetap di
server (`requireRole`). Tombol yang disembunyikan bukan kontrol keamanan.

## Yang belum ada

- Halaman `cards`, `devices`, `rules`, `settings`, `attendance` masih placeholder.
- Import XLSX massal untuk siswa (belum diminta).
- Test komponen (belum ada setup Testing Library).
- Indikator offline/PWA (belum perlu).
- Semua verifikasi runtime: `npm run dev` belum dijalankan karena sesi ini tidak
  punya tool terminal.
