# Dashboard — Data & Filter

## Filter orang

Tiga mode: **Semua**, **Siswa**, **Guru**. Filter dikirim sebagai
`?personType=STUDENT|TEACHER` ke `/dashboard/stats`, `/dashboard/trend`, dan
`/dashboard/by-class`. Satu `DashboardFilterProvider` membagikan state ke semua
kartu agar angka tidak saling bertentangan.

## Filter rentang tanggal

Semua panel dashboard menerima `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
Preset cepat: Hari ini, 7 hari, 30 hari, Bulan ini, atau rentang manual.

Aturan:

| Hal | Nilai |
| --- | --- |
| Maksimum rentang | 366 hari |
| Maksimum grafik tren | 90 hari (payload) |
| Tanggal awal > akhir | ditolak di UI dan server |
| `date` + `from`/`to` bersamaan | ditolak server |
| Tanpa parameter | default hari ini |

### Kenapa `attendanceRate` memakai "orang-hari"

Bila rentang 7 hari dan ada 100 siswa, penyebutnya **bukan** 100 melainkan
`100 × hari_kerja`. Kalau memakai 100, persentase akan tampak 700% atau selalu
100%. `workdays` dihitung Senin–Jumat dalam rentang (hari libur nasional belum
dikurangkan — lihat keterbatasan di bawah).

Hari kerja dipakai, bukan total hari, karena `recompute` tidak membuat baris
untuk Sabtu/Minggu. Memakai total hari akan menurunkan persentase secara palsu.

Filter **tidak** mempengaruhi panel `Kehadiran per Kelas` (memang khusus siswa)
dan `Tap Terakhir` (log mentah, tanpa filter).

## Data yang ditampilkan

| Panel | Isi | Sumber |
| --- | --- | --- |
| Hadir / Terlambat / Alfa / Total Tap | 4 kartu utama | `attendance_daily` + `tap_logs` |
| Tingkat Kehadiran | persentase + bar, warna mengikuti ambang 90/75 | `attendanceRate` |
| Populasi | jumlah siswa, guru, device aktif | `Person`, `Device` |
| Kualitas Tap | diterima / duplikat / ditolak / kartu asing | `tap_logs.decision` |
| Tren 7 Hari | 3 garis (hadir, terlambat, alfa) | `attendance_daily` |
| Tap Terakhir | 8 tap terbaru, polling 30 detik | `tap_logs` |
| Kehadiran per Kelas | bar per kelas + jumlah alfa | `attendance_daily` |
| Tap Sholat | Dhuha / Dhuhur / Ashar + persentase | kolom `prayer*At` |

## Kenapa metrik ini

- **Tingkat Kehadiran** dihitung `(hadir + terlambat) / eligible`, bukan
  `hadir / total`, karena siswa terlambat tetap hadir secara fisik. Menghitungnya
  sebagai tidak hadir akan membuat angka terlihat lebih buruk dari kenyataan.
- **Kualitas Tap** memisahkan `DUPLICATE` dan `UNKNOWN_CARD`. Lonjakan duplikat
  biasanya berarti reader terlalu sensitif atau kartu menempel; lonjakan kartu
  asing berarti ada kartu belum terdaftar. Dua hal ini butuh tindakan berbeda.
- **Tap Sholat** memakai kolom yang sudah tersimpan sejak awal tetapi selama ini
  tidak pernah tampil. Tanpa panel ini, data sholat hanya bisa dilihat lewat export.
- **Kehadiran per Kelas** membantu wali kelas melihat kelasnya sendiri tanpa
  harus memfilter manual di halaman Rekap.

## Keterbatasan

- Semua panel memakai `attendance_daily`, jadi **butuh recompute** agar terisi.
  Bila job rollup belum pernah jalan, angka `Hadir` akan 0 padahal ada tap.
- Tren maksimal 90 hari; rentang lebih panjang akan ditolak server.
- `workdays` mengabaikan `Holiday` — hari libur nasional masih dihitung sebagai
  hari kerja, sehingga persentase bisa sedikit lebih rendah dari seharusnya.
- `Kehadiran per Kelas` hanya siswa — guru tidak punya kelas.
- Belum ada perbandingan antar periode (minggu ini vs minggu lalu).
