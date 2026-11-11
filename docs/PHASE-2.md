# Phase 2 — Log, Rekap & Rollup

Status: **selesai** (kode). Belum diverifikasi dengan `tsc` CLI / database nyata.

## File baru

| File | Isi |
| --- | --- |
| `be/src/modules/attendance/recompute.ts` | `recomputeRange()` — bangun ulang `AttendanceDaily` dari `TapLog` |
| `be/src/modules/attendance/routes.ts` | `/attendance/daily`, `/summary`, `/monthly`, `/dashboard/stats`, `/attendance/recompute` |
| `be/src/modules/logs/routes.ts` | `/logs`, `/logs/export.xlsx`, `PATCH /logs/:id` |
| `be/src/jobs/rollup-daily.ts` | Job harian: recompute 7 hari terakhir |

## Keputusan desain

### Recompute idempotent, bukan incremental
`recomputeRange()` **tidak** membaca `AttendanceDaily` lama. Ia mulai dari
`emptyDaily()` lalu menerapkan tap berurutan, sama seperti jalur realtime.
Konsekuensinya: hasil recompute tidak mungkin "drift" terhadap jalur realtime,
karena keduanya memanggil `applyTap()` yang sama. Kalau ada bug di `applyTap()`,
recompute akan mereproduksi bug yang sama — itu justru diinginkan (konsisten),
dan perbaikannya cukup di satu tempat.

### Weekend di-skip, hari libur jadi LIBUR
- Sabtu/Minggu tidak dibuatkan baris sama sekali (tidak dianggap hari sekolah).
- `Holiday` dengan `isSchoolDay = false` → baris dengan status `LIBUR`.
- Hari kerja tanpa tap → `ALFA` (default dari `emptyDaily()`).

Hari libur yang jatuh di weekend tidak menghasilkan baris ganda karena weekend
di-skip lebih dulu.

### `/attendance/daily` tidak menulis DB
Kalau baris `AttendanceDaily` belum ada untuk tanggal itu (mis. job rollup belum
jalan), endpoint menampilkan `ALFA` secara virtual tanpa membuat baris. Ini
mencegah GET mengubah state, dan mencegah ribuan baris `ALFA` palsu terbuat
sebelum jam pulang.

### Export XLSX pakai `reply.hijack()`
ExcelJS streaming writer menulis langsung ke `reply.raw`. Karena itu header HTTP
harus di-set **sebelum** stream mulai ditulis, dan Fastify tidak boleh ikut
mengirim reply. `reply.hijack()` mengambil alih kendali response.

Data diambil bertahap 500 baris (cursor pada `id`, urut `tappedAt ASC, id ASC`)
lalu `.commit()` per baris, sehingga workbook tidak menahan seluruh hasil di
memori.

### Batas rentang export 366 hari
Divalidasi sebelum query. Tanpa batas ini, satu request bisa menarik seluruh
riwayat tap dan membuat proses kehabisan memori.

### Koreksi manual memicu recompute
`PATCH /logs/:id` mengubah log, menulis `AuditLog`, lalu memanggil
`recomputeRange` untuk person + tanggal log tersebut saja. Dashboard dan log
tidak boleh berbeda angka.

## Yang belum ada

- Rate limit pada `/logs/export.xlsx` (belum dibatasi; satu admin bisa memicu
  beberapa export besar sekaligus).
- Test otomatis untuk recompute (butuh database; belum ada test container).
- Endpoint `/logs/:id` (detail tunggal) — belum diperlukan FE.
- Scheduler/cron: `rollup-daily.ts` masih script manual, belum dipasang di
  crontab atau platform deploy.
