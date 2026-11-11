# TAPRES — Technical Plan

**TAPRES** = sistem presensi sekolah berbasis tap kartu RFID.
Dirancang sebagai produk yang bisa dipasang di sekolah berbeda tanpa mengubah kode.

Sistem absensi siswa & guru berbasis tap kartu RFID, terintegrasi dengan perangkat IoT
ESP32-S3 + RC522, dengan dashboard web untuk master data, log, dan rekap.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js 22 + TypeScript + Fastify + Zod + Prisma |
| Database | PostgreSQL (Neon / Supabase / Railway) |
| Firmware | Arduino-ESP32 3.3.11 + Arduino_GFX + MFRC522 (LVGL opsional) |
| Hardware | ESP32-S3-Touch-LCD-3.5 (ST7796 320x480) + RC522 13.56 MHz |

---

## 1. Prinsip Arsitektur

1. Monorepo 3 folder: `be/`, `fe/`, `uno/`, dilengkapi `docs/`.
2. `tap_logs` adalah **sumber kebenaran** (append-only, menyimpan payload mentah).
   `attendance_daily` adalah **turunan** yang bisa dibangun ulang kapan saja.
3. Waktu otoritatif = **server** (`Asia/Jakarta`). `deviceTs` hanya untuk audit drift.
4. Device tidak pernah menyentuh database; hanya REST + device key.
5. Idempotency dijamin **constraint database** (`tap_logs.idempotencyKey UNIQUE`),
   bukan di level aplikasi, agar aman terhadap race condition saat retry.
6. Satu tabel `Person` dengan diskriminator `type` (STUDENT | TEACHER), karena
   `RfidCard` dan `TapLog` butuh FK tunggal.

---

## 2. Alur Tap (End-to-End)

```
1. ESP32 baca UID kartu -> debounce 2s -> normalisasi hex uppercase
2. POST /api/v1/device/tap  { uid, deviceTs, idempotencyKey }
3. BE: validasi device key -> lookup RfidCard (status ACTIVE) -> Person
4. BE: INSERT TapLog (selalu, termasuk kartu tidak dikenal)
5. BE: classify(tappedAt, person, rules) -> TapType + decision
6. BE: upsertAttendance(person, date, tap)
7. BE: response kecil (<= 1 KB) -> LCD render nama/kelas/status
```

### Penanganan offline

- Device menyimpan antrian di NVS: `{ uid, ts, idempotencyKey }` (maks 500, drop-oldest).
- Saat koneksi pulih: `POST /device/taps/batch` (maks 100 per request).
- Retry aman karena `idempotencyKey` unik di database.
- `idempotencyKey` = `{deviceCode}:{bootCount}:{seq}`.

---

## 3. Klasifikasi Tap

Aturan prioritas: **PERSON > CLASS > GLOBAL**, lalu `priority DESC`.

```
classify(tappedAt, person, rules):
  t    = tappedAt -> Asia/Jakarta
  rule = rules
    .filter(r =>
        matchesScope(r, person)              // PERSON > CLASS > GLOBAL
        && r.daysOfWeek.includes(t.dow)
        && r.startMinute <= minutes(t) <= r.endMinute
        && inValidityRange(r, t.date))
    .sortBy(priority desc)
    .first()

  if !rule                    -> { tapType: null, decision: REJECTED, reason: OUT_OF_WINDOW }
  if lastTap && gap < minGap  -> { decision: DUPLICATE }
  return { tapType: rule.type, prayerSlot: rule.prayerSlot, ruleId: rule.id, decision: ACCEPTED }
```

### Efek ke `attendance_daily`

| TapType | Efek |
| --- | --- |
| `CLOCK_IN` | Isi `checkInAt` **hanya bila masih null**; status `TERLAMBAT` bila lewat grace |
| `CLOCK_OUT` | `checkOutAt` = tap terakhir |
| `PRAYER` | Isi slot `DHUHA` / `DHUHUR` / `ASHAR` |
| `OTHER` | Hanya log, tidak mengubah absensi |

`lateMinutes = max(0, menit(checkIn) - menit(schoolStart + graceMinutes))`.

### Rollup job

- Cron `00:10 WIB`: isi baris kosong untuk semua person aktif -> status `ALFA`,
  lewati weekend dan `Holiday`.
- Recompute 7 hari terakhir dari `tap_logs` (idempotent upsert) untuk menangkap
  tap yang masuk terlambat dari antrian offline.

---

## 4. Model Data

| Tabel | Fungsi |
| --- | --- |
| `User` | Akun dashboard + role |
| `AcademicYear` | Tahun ajaran aktif |
| `ClassRoom` | Kelas per tahun ajaran |
| `Person` | Siswa & guru (diskriminator `type`) |
| `RfidCard` | Kartu fisik, UID unik, riwayat assign/revoke |
| `Device` | Perangkat tap, `apiKeyHash` (bcrypt) |
| `TapRule` | Aturan waktu -> tipe tap |
| `TapLog` | Event tap mentah (append-only) |
| `AttendanceDaily` | Rekap harian turunan (`personId` + `date` unik) |
| `Holiday` | Hari libur / bukan hari sekolah |
| `Setting` | Konfigurasi sekolah (jam masuk, grace, timezone) |
| `AuditLog` | Jejak perubahan data master & koreksi manual |

Detail field: lihat `be/prisma/schema.prisma`.

---

## 5. API Surface

Base path: `/api/v1`. Format error seragam:
`{ "error": { "code": "...", "message": "...", "details": ... } }`.
Pagination: `?page=1&limit=50` (limit maksimum 200).

### Auth
`POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

### Device (header `X-Device-Code` + `X-Device-Key`)
`POST /device/tap` · `POST /device/taps/batch` · `POST /device/heartbeat` · `GET /device/bootstrap`

### Master
`/students` · `/teachers` · `/classes` · `/cards` · `/devices` · `/rules` · `/holidays`
(masing-masing GET list, POST, GET /:id, PATCH /:id, DELETE /:id)

### Log & Attendance
`GET /logs` · `GET /logs/export.xlsx` · `PATCH /logs/:id` ·
`GET /attendance/daily` · `GET /attendance/summary` · `GET /attendance/monthly` ·
`GET /dashboard/stats` · `POST /attendance/recompute`

Detail kontrak request/response: lihat `docs/api.md`.

---

## 6. RBAC

| Role | Hak |
| --- | --- |
| `VIEWER` | Read-only semua halaman |
| `OPERATOR` | + CRUD master, koreksi log |
| `ADMIN` | + device, rules, recompute, export massal |
| `SUPER_ADMIN` | + manajemen user |

Device tidak memakai JWT; hanya device key yang di-hash di database dan bisa
di-rotate tanpa downtime.

---

## 7. Roadmap Implementasi

### Phase 0 — Fondasi
1. Inisialisasi repo, `.gitignore`, `README.md`, folder `docs/`.
2. Scaffold `be/`, `fe/`, `uno/` beserta konfigurasi dasar.
3. Docker Compose PostgreSQL lokal + `.env.example`.

### Phase 1 — Data & Auth (BE)
4. Prisma schema + migration awal + seeder (tahun ajaran, kelas, siswa, guru, device, rule default).
5. Modul auth (JWT httponly cookie) + RBAC guard.
6. Modul master (students/teachers/classes/cards/devices) + Zod + soft delete + audit log.

### Phase 2 — Tap Pipeline (BE) — JALUR KRITIS
7. `POST /device/tap`: device guard -> lookup kartu -> insert log -> classify -> upsert attendance -> response.
8. Unit test `classify()` (matrix minimal 20 kasus).
9. `taps/batch` + test idempotency, `heartbeat`, `bootstrap`.
10. Rollup job harian + recompute rentang.

### Phase 3 — FE Core
11. Layout dashboard, sidebar, auth guard (middleware), refresh-token interceptor.
12. Halaman dashboard: KPI card, tren 7 hari, tabel tap terakhir (polling 30s).
13. Halaman master: students, teachers, classes (tabel + filter + form + soft delete).

### Phase 4 — Log, Attendance, Export
14. Halaman `cards`: assign / reassign / revoke.
15. Halaman `logs`: filter server-side, pagination.
16. `GET /logs/export.xlsx` (ExcelJS streaming) + tombol export mengikuti filter aktif.
17. Halaman `attendance`: rekap harian per kelas, rekap bulanan (grid siswa x tanggal), koreksi manual.
18. Halaman `devices` & `rules` (device key reveal-once, rule editor + dry-run preview).

### Phase 5 — Firmware
19. RC522 di bus SPI terpisah, debounce 2s, normalisasi UID.
20. State machine LCD: `IDLE -> READING -> SENDING -> SUCCESS | UNKNOWN | DUPLICATE | OFFLINE`.
21. WiFi manager + NTP (tampilan saja) + heartbeat 60s.
22. Offline queue NVS + flush batch.
23. Provisioning via captive portal (SSID, BE_URL, deviceCode, deviceKey).

### Phase 6 — Hardening & Deploy
24. Rate limit device (60 req/menit), body limit 4 KB.
25. Test: classify matrix, idempotency, RBAC, export smoke test.
26. CI: lint + typecheck + test + `prisma migrate diff`.
27. Deploy: BE ke Railway/Fly.io, Postgres Neon, FE ke Vercel.
28. Operasional: backup harian, retensi log 12 bulan, dokumen provisioning.

---

## 8. Task Delegation

| Agent | Scope |
| --- | --- |
| `PlannerArchitect` | Phase 0, dokumen, review schema |
| `Developer` | Phase 1–4 (BE + FE) |
| `IoTEngineer` | Phase 5 (firmware, wiring, provisioning) |
| `Designer` | Phase 3 (UI dashboard, komponen konsisten) |
| `ReviewerQA` | Phase 6 (review, test matrix, laporan bug) |

**Urutan wajib:** Phase 2 selesai & teruji sebelum Phase 5, karena firmware
hanya bisa diuji end-to-end bila `/device/tap` sudah stabil.

---

## 9. Acceptance Criteria

| # | Requirement | Kriteria Lulus |
| --- | --- | --- |
| 1 | Tap -> identitas | Kartu valid: LCD tampil nama + kelas + status < 1.5s (LAN); response <= 1 KB. Kartu tak dikenal -> pesan jelas, tidak crash. |
| 2 | Log tersimpan | Setiap tap (termasuk `UNKNOWN_CARD`) tercatat di `tap_logs` dengan `tappedAt` server. Retry device tidak membuat baris ganda (dibuktikan test). |
| 3 | Klasifikasi jam | Lulus: clock-in normal, terlambat, tap dobel < 2 menit -> `DUPLICATE`, di luar window -> `REJECTED`, tap sholat mengisi slot benar. Prioritas `PERSON > CLASS > GLOBAL` dihormati. |
| 4 | Summary harian/bulanan | Rekap harian == recompute dari `tap_logs` (selisih 0). Rekap bulanan konsisten dengan jumlah harian. Hari libur tidak menghasilkan `ALFA`. |
| 5 | Master data | CRUD lengkap; satu kartu tidak bisa aktif untuk dua orang; soft delete tidak menghapus riwayat log; rotate device key hanya ADMIN. |
| 6 | Log di web + XLSX | Filter UI == isi file. Export 12 bulan tanpa timeout/OOM. Kolom: NIS/NIP, nama, tipe, kelas, waktu, tipe tap, keputusan. |

### Non-fungsional
- Device key tidak pernah tersimpan plaintext.
- Kartu RFID **bukan** autentikasi/otorisasi transaksi (UID Mifare bisa dikloning).
- Semua endpoint master wajib JWT; `VIEWER` tidak dapat menulis.
- Semua timestamp disimpan `timestamptz` dan ditampilkan dalam `Asia/Jakarta`.

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| UID dikloning | RFID hanya identifier; log mencatat device + waktu; koreksi manual oleh admin tercatat di `AuditLog` |
| Internet sekolah putus | Offline queue NVS + batch sync + idempotency |
| Jam device melenceng | Server time otoritatif; `deviceTs` hanya audit |
| RC522 bentrok dengan bus LCD | Bus SPI terpisah (lihat `docs/wiring.md`) |
| Data tidak cocok antara log & rekap | Recompute idempotent + test selisih 0 |
| Lonjakan data log | Index `(personId, tappedAt)` & `(tappedAt)`; retensi 12 bulan |

---

## 11. Open Questions

1. Berapa jumlah device tap per sekolah, dan apakah perlu multi-tenant (banyak sekolah dalam 1 instalasi)?
2. LCD menampilkan foto siswa atau cukup teks nama + kelas?
3. Apakah guru juga wajib tap sholat, atau hanya siswa?
4. Jam sholat fixed atau bergeser per bulan (butuh rule per rentang tanggal)?
5. Apakah perlu integrasi WhatsApp/notifikasi ke orang tua saat siswa `ALFA`?
