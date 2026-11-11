# Aturan Klasifikasi Tap

Dokumen ini menjadi acuan implementasi `classify()` di
`be/src/modules/device/classify.service.ts` dan rule editor di dashboard.

## 1. Konsep

Satu tap menghasilkan satu `TapLog`. `TapLog` kemudian dipetakan ke `TapType`
berdasarkan **rule** yang cocok dengan waktu tap.

```
TapType = CLOCK_IN | CLOCK_OUT | PRAYER | OTHER
```

`TapRule` disimpan di database (bukan hardcode) agar admin bisa mengubah jam
masuk, jam pulang, dan jam sholat tanpa deploy ulang.

## 2. Struktur Rule

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `name` | string | contoh `"Masuk Pagi"` |
| `type` | TapType | tipe hasil klasifikasi |
| `prayerSlot` | DHUHA / DHUHUR / ASHAR / null | wajib bila `type = PRAYER` |
| `scope` | GLOBAL / CLASS / PERSON | tingkat kekhususan |
| `classId` / `personId` | string? | dipakai sesuai scope |
| `daysOfWeek` | int[] | 0=Minggu ... 6=Sabtu |
| `startMinute` / `endMinute` | int | menit sejak 00:00 (07:00 = 420) |
| `minGapMinutes` | int | jarak minimum dari tap valid sebelumnya |
| `priority` | int | tie-breaker bila scope sama |
| `validFrom` / `validTo` | date? | untuk jam sholat yang bergeser |
| `isActive` | bool | rule bisa dinonaktifkan tanpa dihapus |

## 3. Algoritma

```
1. Ambil semua rule aktif milik sekolah.
2. Filter:
   a. scope cocok:
        GLOBAL  -> selalu
        CLASS   -> rule.classId == person.classId
        PERSON  -> rule.personId == person.id
   b. daysOfWeek memuat hari tap (0..6, timezone sekolah)
   c. startMinute <= menitTap <= endMinute
   d. tanggal tap dalam [validFrom, validTo] bila diisi
3. Urutkan: scope (PERSON=3, CLASS=2, GLOBAL=1) DESC, lalu priority DESC.
4. Ambil rule pertama.
5. Bila tidak ada rule -> decision = REJECTED, reason = OUT_OF_WINDOW.
6. Bila jarak tap < rule.minGapMinutes dari tap ACCEPTED terakhir hari itu
   -> decision = DUPLICATE, retryAfterSeconds dihitung.
7. Selain itu -> decision = ACCEPTED.
```

## 4. Efek pada AttendanceDaily

| TapType | Aksi |
| --- | --- |
| `CLOCK_IN` | Bila `checkInAt` null: isi, hitung `lateMinutes`, set status `HADIR`/`TERLAMBAT` |
| `CLOCK_OUT` | `checkOutAt` = waktu tap terakhir |
| `PRAYER` (DHUHA) | Isi `prayerDhuhaAt` |
| `PRAYER` (DHUHUR) | Isi `prayerDhuhurAt` |
| `PRAYER` (ASHAR) | Isi `prayerAsharAt` |
| `OTHER` | Tidak mengubah attendance |

`lateMinutes = max(0, menitTap - (schoolStartMinute + graceMinutes))`

`schoolStartMinute` dan `graceMinutes` diambil dari tabel `Setting`
(misal 07:00 dan 15 menit).

## 5. Rule Default (seeder)

| Nama | Type | Slot | Hari | Window | Prioritas |
| --- | --- | --- | --- | --- | --- |
| Masuk Pagi | CLOCK_IN | — | Sen–Jum (1–5) | 06:00–07:15 | 0 |
| Pulang Sekolah | CLOCK_OUT | — | Sen–Jum (1–5) | 13:00–16:00 | 0 |
| Sholat Dhuha | PRAYER | DHUHA | Sen–Jum | 09:30–10:15 | 10 |
| Sholat Dhuhur | PRAYER | DHUHUR | Sen–Jum | 11:45–12:45 | 10 |
| Sholat Ashar | PRAYER | ASHAR | Sen–Jum | 15:00–15:45 | 10 |
| Tap Ekstrakurikuler | OTHER | — | Sab (6) | 07:00–12:00 | 0 |

Catatan: window sholat yang bergeser per bulan ditangani dengan rule tambahan
yang memakai `validFrom`/`validTo`, bukan mengubah rule lama.

## 6. Kasus Uji Wajib (unit test)

| # | Skenario | Ekspektasi |
| --- | --- | --- |
| 1 | Tap 06:45 hari Senin | `CLOCK_IN`, `HADIR` |
| 2 | Tap 07:10 hari Senin | `CLOCK_IN`, `HADIR` (dalam grace) |
| 3 | Tap 07:20 hari Senin | `CLOCK_IN`, `TERLAMBAT`, late = 5 |
| 4 | Tap 08:00 hari Senin | `REJECTED` OUT_OF_WINDOW |
| 5 | Tap 09:45 hari Senin | `PRAYER` DHUHA |
| 6 | Tap 12:00 hari Senin | `PRAYER` DHUHUR |
| 7 | Tap 15:20 hari Senin | `PRAYER` ASHAR |
| 8 | Tap 14:00 hari Senin | `CLOCK_OUT` |
| 9 | Tap kedua 1 menit setelah clock-in | `DUPLICATE` |
| 10 | Tap kedua 3 menit setelah clock-in | `ACCEPTED` (lolos gap) |
| 11 | Tap hari Sabtu 08:00 | `OTHER` |
| 12 | Tap hari Minggu | `REJECTED` |
| 13 | Tap pada hari libur nasional | `REJECTED` atau `OTHER` sesuai setting |
| 14 | Kartu tidak terdaftar | `UNKNOWN_CARD`, log tetap dibuat |
| 15 | Kartu status `LOST` | `UNKNOWN_CARD` + alert ke dashboard |
| 16 | Rule PERSON override rule CLASS | rule PERSON menang |
| 17 | Rule CLASS override rule GLOBAL | rule CLASS menang |
| 18 | Dua rule GLOBAL overlap | `priority` lebih tinggi menang |
| 19 | Rule dengan `validTo` terlewat | rule tidak dipakai |
| 20 | Clock-in kedua setelah tap sholat | `checkInAt` tidak berubah |

## 7. Recompute

`attendance_daily` adalah cache. Aturan recompute:

1. Hapus/override baris untuk rentang tanggal yang diminta.
2. Ambil `tap_logs` dengan `decision = ACCEPTED` untuk rentang tersebut.
3. Terapkan ulang efek per `TapType` secara kronologis.
4. Untuk hari sekolah tanpa tap -> status `ALFA`.
5. Untuk hari libur (`Holiday.isSchoolDay = false`) -> status `LIBUR`.
6. Hasil harus **identik** dengan perhitungan realtime (diuji di CI).

Koreksi manual (`PATCH /logs/:id`) selalu diikuti recompute agar angka
dashboard dan log konsisten.
