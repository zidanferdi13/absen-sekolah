# Phase 4 — Log, Rekap, Export, Master Lanjutan

Status: **selesai** (kode). Belum dijalankan di browser.

## File baru / diubah

| File | Isi |
| --- | --- |
| `be/src/modules/master/rules.routes.ts` | CRUD `/rules` + `POST /rules/preview` (dry-run) |
| `fe/src/components/card-manager.tsx` | Tabel kartu, terbitkan, revoke |
| `fe/src/components/log-manager.tsx` | Filter lengkap, export, modal koreksi |
| `fe/src/components/attendance-manager.tsx` | Tab harian + grid bulanan |
| `fe/src/components/device-manager.tsx` | Device, rotate key, ubah status |
| `fe/src/components/rule-manager.tsx` | Daftar aturan + uji tap |
| `fe/src/components/rule-form-modal.tsx` | Form aturan (dipisah agar ringkas) |

## Keputusan desain

### `/rules/preview` memakai `classify()` yang sama
Dry-run tidak punya logika sendiri. Ia memuat rule aktif, mengonversi ke
`RuleLike`, lalu memanggil `classify()` yang dipakai jalur tap asli. Jadi
hasil preview dijamin sama dengan perilaku produksi — kalau preview bilang
`REJECTED`, tap sungguhan juga akan `REJECTED`.

`lastAcceptedTapAt` sengaja `null` di preview, sehingga status `DUPLICATE`
tidak akan pernah muncul. Ini disengaja: duplikasi bergantung pada tap
sebelumnya, bukan pada aturan.

### Grid bulanan memakai virtual kolom, bukan data per tanggal
`/attendance/monthly` mengembalikan `days: { "01": "HADIR", "02": "ALFA" }`
hanya untuk tanggal yang punya baris. FE merender semua tanggal dalam bulan
dan menampilkan `·` untuk yang kosong. Alternatifnya — BE mengirim 31 entri
`null` per siswa — hanya menambah payload tanpa informasi baru.

### Koreksi log memaksa `decision = ACCEPTED`
`PATCH /logs/:id` menimpa `decision` menjadi `ACCEPTED`. Alasannya: admin
mengoreksi log `REJECTED`/`UNKNOWN_CARD` artinya ia menyatakan tap itu sah.
Tanpa ini, log akan tetap `REJECTED` dan `recomputeRange` (yang hanya membaca
`ACCEPTED`) akan mengabaikan koreksi tersebut — angka rekap tidak berubah
meski admin sudah mengoreksi.

### Rotate key tidak menghentikan device lama secara langsung
Key lama langsung tidak valid setelah rotate (karena hash diganti), tapi
device yang sedang online baru tahu saat request berikutnya gagal `401`.
Firmware menangani ini sebagai error konfigurasi, bukan offline — tap tetap
masuk antrian NVS, tidak hilang.

## Yang belum ada

- Notifikasi/peringatan saat device lama tidak heartbeat > 24 jam.
- Export PDF rekap bulanan.
- Import massal siswa dari XLSX.
- Pagination di halaman kartu per 25 baris (sudah ada), tapi belum ada bulk action.
- Uji browser menyeluruh; verifikasi hanya lewat typecheck language server.

## Tambahan: logo sekolah

Logo diunggah lewat **Pengaturan**, disimpan sebagai data URI base64 di
`Setting` dengan key `school.logo`.

| Hal | Keputusan |
| --- | --- |
| Kompresi | Di browser: `canvas` → maks 256×256 → WebP kualitas turun bertahap sampai ≤ 300 KB |
| Batas server | 400.000 karakter (≈300 KB biner) |
| Validasi | Harus `data:image/(png\|jpeg\|webp);base64,...` |
| Endpoint baca | `GET /settings/branding` — **publik** (dipakai halaman login) |
| Audit log | Nilai base64 diringkas `<N chars>` agar tidak membengkak |

Kenapa tidak upload file ke storage? Belum ada object storage, dan logo hanya
satu berkas kecil per sekolah. Menyimpannya di tabel `Setting` menghindari
tambahan dependency, endpoint upload, dan lifecycle cleanup — dengan konsekuensi
setiap perubahan logo ikut masuk audit log (sudah diringkas).

Kenapa `/settings/branding` publik? Halaman login butuh logo **sebelum**
pengguna punya sesi. Endpoint ini hanya mengembalikan nama sekolah dan logo —
bukan jam masuk, grace period, atau konfigurasi lain.
