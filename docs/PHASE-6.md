# Phase 6 — Hardening, CI & Deploy

Status: **selesai** (kode). Pipeline belum pernah dijalankan di GitHub.

## File baru

| File | Isi |
| --- | --- |
| `be/Dockerfile` | Multi-stage: deps → build → runtime, non-root, healthcheck |
| `be/.dockerignore` | Kecualikan test, dist, .env |
| `be/vitest.config.ts` | Env test otomatis (JWT secret, DATABASE_URL dummy) |
| `be/eslint.config.mjs` | Flat config ESLint 9 + typescript-eslint |
| `be/src/plugins/auth.test.ts` | Test `parseTtlSeconds()` (7 kasus) |
| `fe/Dockerfile` | Multi-stage dengan `output: 'standalone'` |
| `.github/workflows/ci.yml` | 3 job: backend, frontend, firmware |
| `docker-compose.prod.yml` | Postgres + BE + FE, secret lewat env |
| `docs/DEPLOY.md` | Tiga jalur deploy + checklist go-live |

## Bug yang diperbaiki di fase ini

### `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` tidak pernah dipakai
`env.ts` sudah memvalidasi kedua variabel, `.env.example` mencantumkannya,
tapi `plugins/auth.ts` memakai konstanta hardcode `15 * 60` dan `7 * 24 * 60 * 60`.
Artinya mengubah TTL lewat env **tidak berpengaruh apa pun** — admin bisa
mengira sesi sudah diperpendek padahal masih 15 menit.

Sekarang TTL dibaca dari env lewat `parseTtlSeconds()` yang mendukung format
`15m`, `2h`, `7d`, `900`. Fallback dipakai bila format tidak dikenal, bukan
crash saat boot.

### Path `npm start` salah
`tsconfig.json` memakai `rootDir: "."` sehingga output ada di `dist/src/server.js`,
bukan `dist/server.js`. Script `start` dan `CMD` Dockerfile sudah disesuaikan.

### Dockerfile FE butuh `public/`
Stage runtime melakukan `COPY --from=build /app/public ./public`, tapi folder
itu belum ada. Ditambahkan `fe/public/robots.txt`.

## Keputusan desain

### CI memakai `migrate deploy || db push`
Folder `be/prisma/migrations/` belum ada karena migrasi harus dibuat di mesin
dengan database berjalan (tidak bisa dari sesi ini). CI akan mencoba
`migrate deploy`; bila belum ada migrasi, jatuh ke `db push` agar job tetap
memverifikasi bahwa schema valid terhadap Postgres asli.

Setelah Anda menjalankan `prisma migrate dev --name init` (lihat
`be/prisma/migrations/README.md`), jalur `db push` tidak akan terpakai lagi.

### Firmware ikut di-CI
`pio run` di GitHub Actions menangkap error kompilasi Arduino yang tidak
terdeteksi oleh editor. Ini penting karena firmware di fase 5 belum pernah
benar-benar dikompilasi.

### Secret produksi wajib eksplisit
`docker-compose.prod.yml` memakai `${VAR:?pesan}` untuk JWT secret sehingga
compose **menolak start** bila variabel kosong. Lebih baik gagal saat deploy
daripada berjalan dengan secret default.

## Yang belum ada

- Belum ada migrasi awal (harus dibuat di mesin Anda; lihat README migrasi).
- Test integrasi HTTP dengan `app.inject()` + database nyata.
- Rate limit pada `/logs/export.xlsx`.
- Monitoring/alerting (Sentry, uptime check).
- Backup otomatis belum dikonfigurasi — hanya didokumentasikan.
