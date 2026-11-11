# API Contract — TAPRES

Base URL: `/api/v1`
Content-Type: `application/json`
Timezone server: `Asia/Jakarta`

## Konvensi umum

**Error**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "uid wajib diisi", "details": [] } }
```

| HTTP | Code | Arti |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | payload tidak lolos Zod |
| 401 | `UNAUTHORIZED` | token/device key tidak valid |
| 403 | `FORBIDDEN` | role tidak cukup |
| 404 | `NOT_FOUND` | resource tidak ada |
| 409 | `CONFLICT` | duplikat (uid kartu, nis, nip) |
| 429 | `RATE_LIMITED` | melebihi kuota |
| 500 | `INTERNAL_ERROR` | error tak terduga |

**Pagination**
`?page=1&limit=50` -> `{ "data": [...], "meta": { "page": 1, "limit": 50, "total": 1234 } }`

---

## 1. Device API

Autentikasi: header `X-Device-Code` dan `X-Device-Key`.
Device tidak memakai JWT.

### POST /device/tap

Request:
```json
{
  "uid": "A1B2C3D4",
  "deviceTs": "2026-11-11T07:12:03+07:00",
  "idempotencyKey": "GATE-01:42:1837"
}
```

Response `200` (semua keputusan bisnis memakai 200 agar firmware satu jalur render):
```json
{
  "decision": "ACCEPTED",
  "tapType": "CLOCK_IN",
  "person": {
    "name": "Ahmad Fauzi",
    "type": "STUDENT",
    "nis": "2501001",
    "className": "7A",
    "photoUrl": null
  },
  "status": "HADIR",
  "message": "Selamat pagi, Ahmad",
  "serverTime": "2026-11-11T07:12:04+07:00"
}
```

Varian `decision`:

| decision | Keterangan | Field tambahan |
| --- | --- | --- |
| `ACCEPTED` | tap valid & tercatat | `tapType`, `person`, `status` |
| `DUPLICATE` | tap terlalu cepat dari tap sebelumnya | `retryAfterSeconds` |
| `REJECTED` | di luar window rule | `reason: "OUT_OF_WINDOW"` |
| `UNKNOWN_CARD` | UID tidak terdaftar / kartu tidak aktif | — |

### POST /device/taps/batch

Sync antrian offline, maksimal 100 item per request.

```json
{
  "taps": [
    { "uid": "A1B2C3D4", "deviceTs": "...", "idempotencyKey": "GATE-01:42:1837" }
  ]
}
```
Response: `{ "accepted": 98, "duplicates": 2, "rejected": 0, "results": [] }`

### POST /device/heartbeat

```json
{ "firmwareVersion": "1.0.0", "ip": "192.168.1.42", "rssi": -61 }
```
Response: `{ "ok": true, "serverTime": "..." }` — memperbarui `lastSeenAt`.

### GET /device/bootstrap

Response:
```json
{
  "schoolName": "SMKN 2 Tanjung Raya",
  "timezone": "Asia/Jakarta",
  "serverTime": "2026-11-11T07:00:00+07:00",
  "rulesVersion": "2026-11-01T00:00:00Z",
  "heartbeatIntervalSec": 60
}
```

---

## 2. Auth API

| Method | Path | Body | Keterangan |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` | Set cookie `access` + `refresh` |
| POST | `/auth/refresh` | — | Rotate refresh token |
| POST | `/auth/logout` | — | Hapus cookie |
| GET | `/auth/me` | — | `{ id, email, name, role }` |

Durasi token dibaca dari env `ACCESS_TOKEN_TTL` (default `15m`) dan
`REFRESH_TOKEN_TTL` (default `7d`). Format: `<angka><s|m|h|d>`.

Token disimpan di cookie `httpOnly`, `Secure`, `SameSite=Lax`. Tidak ada token di localStorage.

---

## 3. Master API

Semua endpoint butuh JWT. `VIEWER` read-only.

| Resource | Query filter | Catatan |
| --- | --- | --- |
| `GET /students` | `q, classId, status` | `status=active\|inactive\|deleted` |
| `GET /teachers` | `q, status` | |
| `GET /classes` | `academicYearId` | |
| `GET /academic-years` | — | Dipakai halaman kelas |
| `GET /cards` | `status, assigned, q` | `q` mencari UID atau nama pemilik |
| `GET /devices` | `status` | `apiKey` hanya dikembalikan sekali saat create/rotate |
| `GET /rules` | `isActive, type` | |
| `GET /holidays` | `year` | |
| `GET /settings` | — | Key-value |

### Branding (publik)

`GET /settings/branding` — tanpa autentikasi. Dipakai halaman login.

```json
{ "schoolName": "SMKN 2 Tanjung Raya", "logo": "data:image/webp;base64,..." }
```

`logo` bernilai `null` bila belum diunggah. Hanya berisi nama dan logo —
konfigurasi lain tetap butuh JWT.

### Logo sekolah

Disimpan di `Setting` dengan key `school.logo`, format data URI base64
(`png`/`jpeg`/`webp`), maksimum 400.000 karakter. FE mengompres ke 256px
WebP sebelum mengirim, jadi ukuran normal ±20–40 KB.

### Preview aturan (dry-run)

`POST /rules/preview` — body `{ uid, at }` (ISO datetime). Menjalankan
`classify()` yang sama dengan jalur tap asli tanpa menulis log. `DUPLICATE`
tidak mungkin muncul karena tidak ada tap sebelumnya dalam simulasi.

Contoh create siswa:
```json
POST /students
{
  "nis": "2501001",
  "fullName": "Ahmad Fauzi",
  "gender": "L",
  "classId": "clx...",
  "rfidUid": "A1B2C3D4"
}
```
`rfidUid` opsional — bila dikirim, kartu baru langsung di-assign. Bila UID sudah
dipakai orang lain -> `409 CONFLICT`.

### Card assignment

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/cards` | Terbitkan kartu baru `{ uid, label?, personId? }` |
| PATCH | `/cards/:id` | Reassign `{ personId }` — melepas kartu lama otomatis |
| POST | `/cards/:id/revoke` | Set `status: LOST/INACTIVE`, `revokedAt = now()` |

Aturan: satu orang boleh punya >1 kartu, tetapi satu kartu hanya boleh
`ACTIVE` untuk satu orang (dijaga constraint + service).

---

## 4. Log & Attendance API

### GET /logs

Query: `from, to, personId, classId, tapType, decision, q, page, limit`

```json
{
  "data": [
    {
      "id": "log_...",
      "uid": "A1B2C3D4",
      "person": { "name": "Ahmad Fauzi", "nis": "2501001", "className": "7A" },
      "device": { "code": "GATE-01", "name": "Gerbang Utama" },
      "tappedAt": "2026-11-11T07:12:03+07:00",
      "tapType": "CLOCK_IN",
      "decision": "ACCEPTED",
      "reason": null
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 1 }
}
```

### GET /logs/export.xlsx

Streaming ExcelJS, mengikuti filter yang sama dengan `/logs`.
Batas maksimum rentang 12 bulan. Kolom:

`NIS/NIP | Nama | Tipe | Kelas | Waktu | Tipe Tap | Keputusan | Alasan | Device`

### PATCH /logs/:id

Koreksi manual (ADMIN+). Mengubah `tapType`/`decision`, menulis `AuditLog`,
lalu memicu recompute `attendance_daily` untuk person+tanggal terkait.

```json
{ "tapType": "CLOCK_IN", "reason": "Salah tap, koreksi manual oleh admin" }
```

### GET /attendance/daily

Query: `date=2026-11-11&classId=...`
Response: ringkasan + daftar siswa dengan status masing-masing.

### GET /attendance/summary

Query: `from, to, groupBy=class|person`
Response: `{ "data": [ { "key": "7A", "hadir": 30, "terlambat": 2, "alfa": 1 } ] }`

### GET /attendance/monthly

Query: `month=2026-11&classId=...`
Response: grid `person x tanggal` untuk halaman rekap bulanan.

### GET /dashboard/stats

Query: `from=YYYY-MM-DD&to=YYYY-MM-DD` (atau `date=`), `personType=STUDENT|TEACHER` (opsional).
Tanpa parameter → hari ini. Maksimum rentang 366 hari.
Response:
```json
{
  "date": null,
  "from": "2026-11-01",
  "to": "2026-11-11",
  "days": 11,
  "workdays": 8,
  "personType": null,
  "totalStudents": 320,
  "totalTeachers": 24,
  "eligiblePersons": 2752,
  "hadir": 2400,
  "terlambat": 96,
  "izin": 24,
  "sakit": 16,
  "alfa": 120,
  "libur": 0,
  "attendanceRate": 90,
  "totalTaps": 4900,
  "activeDevices": 3,
  "taps": { "accepted": 4820, "duplicate": 50, "rejected": 20, "unknownCard": 10 },
  "prayer": { "dhuha": 2100, "dhuhur": 2050, "ashar": 1900 }
}
```

`eligiblePersons` = jumlah orang × `workdays`. `attendanceRate` =
`(hadir + terlambat) / eligiblePersons` — terlambat tetap dihitung hadir
secara fisik.

### GET /dashboard/trend

Query: `from`/`to`, atau `days=1..90` (default 7), `personType=STUDENT|TEACHER`.
Response: `{ "from", "to", "personType", "data": [{ "date", "hadir", "terlambat", "alfa", "izin", "sakit", "libur" }] }`
Rentang > 90 hari → `400 RANGE_TOO_LARGE`.

### GET /dashboard/by-class

Query: `from`/`to` atau `date` (default hari ini). Khusus siswa.
Response per kelas: `{ classId, className, students, hadir, terlambat, alfa, attendanceRate }`
plus `workdays` dan `totalStudents` di root.

### POST /attendance/recompute

ADMIN+. Body: `{ "from": "2026-11-01", "to": "2026-11-11", "personId": null }`
Idempotent — hasil harus sama dengan hitungan ulang dari `tap_logs`.

---

## 5. Rate Limit & Limit Body

| Endpoint | Limit |
| --- | --- |
| `/device/tap` | 60 req/menit per device |
| `/device/taps/batch` | 10 req/menit per device |
| `/auth/login` | 10 req/menit per IP |
| Body size | 4 KB (device), 1 MB (master) |
