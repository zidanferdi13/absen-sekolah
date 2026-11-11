# TAPRES — Dipakai di Sekolah Lain

Tujuan: satu basis kode untuk banyak sekolah. Identitas sekolah harus **data**,
bukan kode.

## Yang sudah data (tanpa ubah kode)

| Hal | Disimpan di | Diatur lewat |
| --- | --- | --- |
| Nama sekolah | `Setting: school.name` | Pengaturan |
| Logo sekolah | `Setting: school.logo` | Pengaturan |
| Jam masuk | `Setting: school.startMinute` | Pengaturan |
| Toleransi terlambat | `Setting: school.graceMinutes` | Pengaturan |
| Zona waktu | env `SCHOOL_TIMEZONE` | env (per deployment) |
| Kelas & tahun ajaran | tabel `ClassRoom`, `AcademicYear` | Master data |
| Siswa, guru, kartu | tabel `Person`, `RfidCard` | Master data |
| Jam masuk/pulang/sholat | tabel `TapRule` | Aturan Tap |
| Hari libur | tabel `Holiday` | (belum ada UI) |
| Perangkat | tabel `Device` | Perangkat |

Nama sekolah dan logo juga dikirim ke device lewat `GET /device/bootstrap` dan
ditampilkan di LCD, jadi firmware yang sama tidak menampilkan nama sekolah lain.

## Yang masih per deployment (bukan per sekolah)

Ini pas untuk model **satu instalasi per sekolah**:

- `DATABASE_URL` — tiap sekolah punya database sendiri.
- `JWT_*_SECRET` — tiap deployment punya secret sendiri.
- `SCHOOL_TIMEZONE` — semua sekolah di Indonesia = `Asia/Jakarta`, tapi
  sebaiknya tetap per deployment.

Artinya: untuk sekolah kedua, **deploy ulang** (container/DB baru), lalu isi
master data lewat dashboard. Tidak ada perubahan kode.

## Yang belum mendukung banyak sekolah dalam satu instalasi

Sistem ini **belum** multi-tenant. Tidak ada kolom `schoolId` di tabel mana pun.
Kalau nanti perlu satu server untuk banyak sekolah sekaligus, ini yang harus
dikerjakan:

1. Tambah model `School` (`id`, `name`, `logo`, `timezone`, `settings`).
2. Tambah `schoolId` ke: `User`, `Person`, `ClassRoom`, `AcademicYear`,
   `TapRule`, `TapLog`, `AttendanceDaily`, `Device`, `Holiday`, `Setting`.
3. Semua query difilter `schoolId` dari sesi user (bukan dari input request).
4. `Device` membawa `schoolId` → tap otomatis ter-scope.
5. Index unik jadi komposit: `(schoolId, nis)`, `(schoolId, uid)`, dst.
6. RBAC ditambah peran `SCHOOL_ADMIN` yang terikat satu sekolah.

Estimasi dampak: ~12 file BE, 1 migrasi besar, semua route master dan
laporan perlu filter. Belum dikerjakan karena kebutuhan saat ini satu sekolah
per instalasi.

## Menambah sekolah baru (model sekarang)

```bash
# 1. Deploy instance baru
cp .env.example .env
# isi DATABASE_URL, JWT secret baru, CORS_ORIGIN sekolah itu
docker compose -f docker-compose.prod.yml up -d --build

# 2. Migrasi + seed
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed.ts

# 3. Login, lalu di Pengaturan:
#    - ganti nama sekolah
#    - unggah logo
#    - atur jam masuk + toleransi

# 4. Isi master data: tahun ajaran, kelas, siswa, guru, kartu

# 5. Sesuaikan Aturan Tap (jam sholat tiap sekolah bisa beda)

# 6. Daftarkan device, lalu provisioning firmware dengan key sekolah itu
```

## Catatan penting

- **Jangan** memakai satu database untuk dua sekolah tanpa kolom `schoolId`.
  Data akan tercampur dan laporan bulanan tidak bisa dipisahkan.
- Kartu RFID bisa dipakai lintas sekolah hanya kalau memang direncanakan;
  saat ini `uid` unik global per database, jadi tidak bentrok.
- Device key bersifat per device, bukan per sekolah. Rotate bila device
  berpindah tangan.
