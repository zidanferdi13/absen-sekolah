# Phase 5 — Firmware Provisioning & Operasional

Status: **selesai** (kode). Belum di-flash ke perangkat keras.

## File baru / diubah

| File | Isi |
| --- | --- |
| `uno/src/device_config.h` | **baru** — satu sumber config (NVS) + `isProvisioned()` |
| `uno/src/provisioning.h` | **baru** — captive portal (AP + DNS + form) |
| `uno/src/config.h` | Tambah `PROVISION_TIMEOUT_MS`, `BOOT_BUTTON_PIN`, `ORANGE` |
| `uno/src/display.h` | `showIdle(status, color)`, `showProvisioning()` |
| `uno/src/main.cpp` | Integrasi portal, status LCD, tombol BOOT |
| `uno/src/queue.h` | Simpan `deviceTs` di antrian |
| `uno/src/net.h` | Teruskan `deviceTs` ke antrian + batch, `pendingCount()` |

## Alur provisioning

```
Boot
 └─ config lengkap?
     ├─ tidak → WiFi AP "ABSENSI-SETUP-<MAC>"
     │          → LCD menampilkan SSID + 192.168.4.1
     │          → operator isi SSID/URL/kode/key di form
     │          → simpan NVS → restart
     └─ ya   → STA mode → connect → antrian flush → idle
```

Portal juga bisa dibuka kapan saja dengan **menahan tombol BOOT 3 detik**.
Menahannya lagi akan menutup portal dan kembali ke mode normal.

Portal menutup sendiri setelah 10 menit agar device tidak terjebak di mode AP
bila operator lupa.

## Keputusan desain

### Tanpa library tambahan
Portal memakai `WebServer` + `DNSServer` yang sudah termasuk dalam core
Arduino-ESP32. `WiFiManager` akan menambah ~1 dependency yang harus dipin
versinya, dan kita hanya butuh 5 field — form HTML 60 baris lebih ringan
daripada memelihara fork library.

### `isProvisioned()` menolak key default
Device dianggap belum terkonfigurasi bila `devKey` masih sama dengan
`DEFAULT_DEV_KEY` (`"change-me"`). Tanpa cek ini, device yang baru di-flash
akan mencoba konek ke `192.168.1.10` dan gagal 401 berulang tanpa penjelasan —
sekarang ia langsung masuk mode setup.

### Validasi URL di portal, bukan di firmware runtime
Portal menolak URL tanpa `http://`/`https://` sebelum menyimpan. Lebih baik
gagal di form (operator melihat pesan) daripada gagal di `HTTPClient` saat
jam sibuk sekolah.

### `deviceTs` sekarang ikut tersimpan di antrian
Sebelumnya tap offline kehilangan waktu aslinya — semua tap yang di-flush
mendapat `tappedAt` = waktu server saat sync. Sekarang `deviceTs` disimpan
per entri NVS sehingga audit drift tetap akurat.

Catatan: server tetap memakai `tappedAt` (jam server) sebagai otoritatif.
`deviceTs` hanya untuk audit, sesuai keputusan di `docs/PLAN.md`.

### Status LCD menyertakan jumlah antrian
`Offline - 3 tap menunggu` lebih berguna bagi operator daripada `Offline`
saja. Ini juga indikator apakah antrian NVS menumpuk (perlu dicek koneksinya).

## Yang belum ada

- Tombol factory reset (hapus NVS) — saat ini harus via `esptool erase_flash`.
- OTA update firmware.
- Sinkronisasi waktu dari `serverTime` (sekarang NTP saja; kalau NTP diblokir
  jaringan sekolah, `deviceTs` akan meleset tapi `tappedAt` tetap benar).
- Indikator suara/buzzer pada tap berhasil/gagal.
- Uji di perangkat keras — semua verifikasi hanya typecheck editor.
