# Deployment

Tiga target deploy yang didukung. Pilih satu, jangan campur.

## A. Single VPS dengan Docker Compose

Cara paling sederhana, cocok untuk satu sekolah.

```bash
# 1. Siapkan .env di root repo
cat > .env <<'EOF'
POSTGRES_PASSWORD=ganti-password-kuat
POSTGRES_DB=absen_sekolah
JWT_ACCESS_SECRET=ganti-dengan-string-acak-min-32-karakter
JWT_REFRESH_SECRET=ganti-dengan-string-acak-berbeda-min-32-karakter
CORS_ORIGIN=https://absensi.sekolah.sch.id
EOF

# 2. Build & jalankan
docker compose -f docker-compose.prod.yml up -d --build

# 3. Migrasi & seed (sekali saja)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed.ts
```

Akses: FE di `http://server:3000`, BE di `http://server:3001`.

Letakkan reverse proxy (Nginx/Caddy) di depan untuk TLS. Pastikan `/api/*`
diteruskan ke port 3001 dan sisanya ke 3000.

### Job rollup harian (cron host)

```cron
10 0 * * * cd /srv/absen_sekolah && docker compose -f docker-compose.prod.yml exec -T backend npx tsx src/jobs/rollup-daily.ts >> /var/log/absen-rollup.log 2>&1
```

## B. Split: BE di Railway/Fly.io, FE di Vercel, DB di Neon

### Database (Neon)

1. Buat project, ambil connection string (`...?sslmode=require`).
2. Set `DATABASE_URL` di service BE.

### Backend (Railway / Fly.io)

1. Deploy dari folder `be/` (Dockerfile tersedia).
2. Env wajib: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `CORS_ORIGIN` (URL FE), `SCHOOL_TIMEZONE=Asia/Jakarta`, `NODE_ENV=production`.
3. Container menjalankan `prisma migrate deploy` otomatis saat start.
4. Jalankan seed sekali via shell service, lalu hapus kredensial seed.

### Frontend (Vercel)

1. Root directory: `fe`.
2. Env: `BACKEND_URL=https://<be-host>`.
3. `output: 'standalone'` di `next.config.ts` tidak mengganggu Vercel.

## C. Device (ESP32-S3)

Tidak perlu deploy — lakukan provisioning di lokasi:

1. Flash firmware: `cd uno && pio run -t upload`.
2. Nyalakan device, sambungkan ke AP `ABSENSI-SETUP-<MAC>`.
3. Buka `http://192.168.4.1`, isi SSID sekolah, URL BE publik, kode device,
   dan device key dari dashboard.
4. Pastikan LCD menampilkan `Online`.

Device butuh akses HTTPS keluar ke host BE. Jika jaringan sekolah memakai
captive portal/proxy, pakai HTTP internal + reverse proxy, atau daftarkan
host BE di allowlist.

## Troubleshooting

### `Error: Invalid environment variables: DATABASE_URL: Required`

Berarti `be/.env` tidak ada atau tidak terbaca. Perbaiki:

```bash
cd be
cp .env.example .env
```

`env.ts` memuat `.env` lewat `dotenv/config`. Bila masih gagal:

1. Pastikan file bernama tepat `.env` (bukan `.env.txt`).
2. Pastikan dijalankan dari folder `be/` — dotenv mencari relatif ke cwd.
3. Cek apakah `JWT_ACCESS_SECRET` minimal 16 karakter (sering terlewat).

### `JWT_ACCESS_SECRET: Required` padahal `.env` ada

Secret kurang dari 16 karakter akan muncul sebagai `Required` karena pesan
Zod menyatukan "tidak ada" dan "tidak valid". Buat secret acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Checklist sebelum go-live

- [ ] `POSTGRES_PASSWORD` bukan default.
- [ ] `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` berbeda dan acak (min 32 char).
- [ ] `CORS_ORIGIN` berisi origin FE sebenarnya (bukan `*`).
- [ ] `NODE_ENV=production` → cookie `Secure` (wajib HTTPS).
- [ ] Seed sudah dijalankan, lalu password `admin@sekolah.local` diganti.
- [ ] Cron rollup harian aktif dan pernah sukses sekali.
- [ ] Backup database harian (`pg_dump`) terjadwal dan pernah diuji restore.
- [ ] Device key per device, bukan dipakai bersama.
- [ ] Retensi log 12 bulan disepakati; export XLSX dibatasi 366 hari.
