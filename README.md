# TAPRES

**Sistem Presensi Sekolah berbasis Tap Kartu RFID.**

Siswa dan guru tap kartu RFID 13.56 MHz di perangkat ESP32-S3 + LCD 3.5",
backend mencatat setiap tap, mengklasifikasikannya menjadi Clock In / Clock Out /
tap sholat, lalu dashboard web menampilkan master data, log, rekap harian dan
bulanan, serta export XLSX.

Dirancang **multi-sekolah**: satu instalasi bisa dipakai sekolah berbeda tanpa
mengubah kode — identitas sekolah (nama, logo, jam masuk, toleransi) semuanya
data, bukan hardcode. Lihat [`docs/MULTI-SCHOOL.md`](./docs/MULTI-SCHOOL.md).

## Struktur Repository

```
absen_sekolah/
├── be/       # Backend: Node.js + Fastify + Prisma + PostgreSQL
├── fe/       # Frontend: Next.js 15 + Tailwind + shadcn/ui
├── uno/      # Firmware: ESP32-S3 + RC522 (Arduino/PlatformIO)
└── docs/     # Perencanaan, wiring, kontrak API, aturan klasifikasi
```

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [`docs/PLAN.md`](./docs/PLAN.md) | Arsitektur, alur, model data, roadmap, acceptance criteria |
| [`docs/api.md`](./docs/api.md) | Kontrak API lengkap (device, master, log, attendance) |
| [`docs/rules.md`](./docs/rules.md) | Aturan klasifikasi tap (Clock In/Out/Sholat) + test matrix |
| [`docs/wiring.md`](./docs/wiring.md) | Wiring ESP32-S3 + RC522, pin map terverifikasi |
| [`docs/PHASE-1.md`](./docs/PHASE-1.md) | Status implementasi Phase 1 (auth, master, device API) |
| [`docs/PHASE-2.md`](./docs/PHASE-2.md) | Status implementasi Phase 2 (log, rekap, export, rollup) |
| [`docs/PHASE-3.md`](./docs/PHASE-3.md) | Status implementasi Phase 3 (auth guard, master CRUD, dashboard) |
| [`docs/PHASE-4.md`](./docs/PHASE-4.md) | Status implementasi Phase 4 (kartu, log, rekap, device, aturan) |
| [`docs/PHASE-5.md`](./docs/PHASE-5.md) | Status implementasi Phase 5 (provisioning firmware, status LCD) |
| [`docs/PHASE-6.md`](./docs/PHASE-6.md) | Status implementasi Phase 6 (CI, Docker, hardening) |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Panduan deploy + checklist go-live |
| [`docs/MULTI-SCHOOL.md`](./docs/MULTI-SCHOOL.md) | Yang sudah jadi data vs yang masih per-deployment |
| [`docs/DASHBOARD.md`](./docs/DASHBOARD.md) | Data yang ditampilkan dashboard + alasan metriknya |

## Alur Singkat

1. Siswa/guru tap kartu di perangkat ESP32-S3.
2. Firmware mengirim UID ke `POST /api/v1/device/tap`.
3. Backend menyimpan `TapLog` mentah, mengklasifikasi (Clock In / Clock Out /
   Sholat), lalu memperbarui rekap harian.
4. Dashboard menampilkan summary harian/bulanan, log, dan export XLSX.

## Quick Start (Development)

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd be
npm install
cp .env.example .env
npx prisma migrate dev
npm run seed
npm run dev          # http://localhost:3001

# 3. Frontend
cd ../fe
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000

# 4. Firmware (PlatformIO)
cd ../uno
pio run -t upload
```

## Prasyarat

- Node.js 22+
- Docker (untuk PostgreSQL lokal)
- PlatformIO atau Arduino IDE 2.x dengan ESP32 core 3.3.x

## Status

Tahap perencanaan selesai. Implementasi mengikuti roadmap pada `docs/PLAN.md`.
