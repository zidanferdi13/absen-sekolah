# Phase 1 — Backend Data, Auth & Master

Status: **selesai** (kode), menunggu migrasi database di environment Anda.

## Yang dikerjakan

### Plugin
| File | Isi |
| --- | --- |
| `src/plugins/prisma.ts` | Dekorasi `app.prisma`, connect saat boot, disconnect saat close |
| `src/plugins/auth.ts` | Dua instance JWT bernamespace (`access` + `refresh`), `authenticate`, `requireRole` |
| `src/plugins/device-auth.ts` | Validasi `X-Device-Code` + `X-Device-Key` (bcrypt), update `lastSeenAt` |

Kenapa dua instance JWT bernamespace: access dan refresh memakai secret berbeda
dan TTL berbeda. Dengan namespace, verifikasi token tidak ambigu — token refresh
tidak akan pernah lolos sebagai access token.

### Auth
| Endpoint | Keterangan |
| --- | --- |
| `POST /api/v1/auth/login` | Set cookie `access` (15m) + `refresh` (7d), body hanya profil |
| `POST /api/v1/auth/refresh` | Rotasi refresh token |
| `POST /api/v1/auth/logout` | Hapus cookie |
| `GET /api/v1/auth/me` | Profil user aktif |

Token tidak pernah dikirim di body response — hanya httpOnly cookie.

### Master CRUD
| Route | RBAC tulis |
| --- | --- |
| `/students`, `/teachers` | OPERATOR+ |
| `/classes` | ADMIN+ |
| `/cards` | OPERATOR+ |
| `/devices` | ADMIN+ |
| `/holidays` | ADMIN+ |
| `/settings` | ADMIN+ |

Aturan yang diterapkan:
- UID kartu dinormalisasi (trim, buang spasi/`:`/`-`, uppercase) dan unik.
- Satu orang hanya boleh punya satu kartu `ACTIVE`; assign baru otomatis
  merevoke kartu lama dalam transaksi.
- Soft delete person ikut merevoke kartu aktifnya (log historis tetap utuh).
- Semua mutasi menulis `AuditLog`.
- Device API key hanya dikembalikan sekali saat create / rotate-key (disimpan bcrypt).

### Device API
| Endpoint | Keterangan |
| --- | --- |
| `POST /device/tap` | Rate limit per device (`DEVICE_RATE_LIMIT_PER_MINUTE`) |
| `POST /device/taps/batch` | Maks 100 item, idempotent |
| `POST /device/heartbeat` | Update firmware/IP/lastSeen |
| `GET /device/bootstrap` | Config awal + `rulesVersion` |

`idempotencyKey` dipakai apa adanya dari device (format
`{deviceCode}:{bootCount}:{seq}`), sehingga unik lintas device tanpa prefix ganda.

### Seeder
`prisma/seed.ts` idempotent: 3 settings, 1 tahun ajaran, 3 kelas, 10 siswa,
2 guru, 12 kartu, 1 super admin, 3 device, 6 tap rule.

## Cara menjalankan

```bash
cd be
npm install
docker compose up -d          # dari root repo
cp .env.example .env
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Login: `admin@sekolah.local` / `Admin#12345`
Device key dev: `dev-key-gate-01`, `dev-key-gate-02`, `dev-key-gate-03`

## Test

```bash
cd be
npx vitest run
```

Cakupan saat ini: `classify()` (20 kasus), `applyTap()` (9 kasus),
`normalizeUid()` + `parsePagination()` (6 kasus).

## Belum termasuk Phase 1

- Endpoint `/logs`, `/logs/export.xlsx`, `/attendance/*`, `/dashboard/stats`
  (Phase 4).
- Job rollup `ALFA` harian (Phase 2).
- Provisioning WiFi portal di firmware (Phase 5).
- Integrasi test yang butuh database nyata (baru unit test murni).
