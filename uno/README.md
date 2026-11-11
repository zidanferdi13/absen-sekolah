# Firmware — ESP32-S3-Touch-LCD-3.5 + RC522

Modul:

| File | Isi |
| --- | --- |
| `src/main.cpp` | Setup, loop, state machine LCD, heartbeat |
| `src/config.h` | Pin map (terverifikasi), konstanta perilaku, warna |
| `src/device_config.h` | Config NVS terpusat + `isProvisioned()` |
| `src/provisioning.h` | Captive portal: AP + DNS + form konfigurasi |
| `src/rfid.h` | Pembacaan RC522 pada bus SPI terpisah + debounce |
| `src/display.h` | Driver LCD ST7796 + reset via TCA9554 |
| `src/net.h` | HTTP client: tap, batch sync, heartbeat |
| `src/queue.h` | Antrian offline di NVS (ring buffer, simpan deviceTs) |

## Build & flash

```bash
cd uno
pio run                 # compile
pio run -t upload       # flash
pio device monitor      # serial 115200
```

Setara Arduino IDE: **ESP32S3 Dev Module**, Flash 16MB, PSRAM OPI,
Partition `16M Flash (3MB APP/9.9MB FATFS)`, USB CDC on boot aktif.

## Konfigurasi

### Provisioning (cara utama)

1. Nyalakan device. Bila belum dikonfigurasi, LCD menampilkan **MODE SETUP**
   beserta nama WiFi AP, mis. `ABSENSI-SETUP-1A2B3C`.
2. Sambungkan ponsel/laptop ke WiFi tersebut (tanpa password).
3. Buka `http://192.168.4.1`, isi:
   - SSID & password WiFi sekolah
   - URL backend, mis. `https://api.sekolah.id`
   - Kode device (harus sama dengan dashboard, mis. `GATE-01`)
   - Device key dari menu **Perangkat** di dashboard
4. Simpan → device restart → mencoba terhubung.

Untuk membuka portal kapan saja: **tahan tombol BOOT 3 detik**. Menahannya
lagi akan menutup portal. Portal juga menutup sendiri setelah 10 menit.

### Key NVS

| Key NVS | Isi |
| --- | --- |
| `ssid` | SSID WiFi sekolah |
| `pass` | Password WiFi |
| `beUrl` | Base URL backend |
| `devCode` | Kode device (`GATE-01`) |
| `devKey` | Device key dari dashboard |
| `boots` | Counter boot (dipakai idempotency key) |

## Alur state LCD

```
IDLE -> (kartu terdeteksi) -> READING -> SENDING -> SUCCESS
                                                -> UNKNOWN
                                                -> DUPLICATE
                                                -> REJECTED
                                                -> OFFLINE (masuk antrian)
     -> setelah 3 detik -> IDLE

MODE SETUP (bila belum terprovisioning / tahan BOOT)
```

## Catatan operasional

- `LCD_CS` dan `LCD_RST` dikendalikan TCA9554 (I2C 0x20), bukan GPIO.
  Jangan pindahkan RC522 ke bus LCD.
- `idempotencyKey` = `{deviceCode}:{bootCount}:{seq}` — unik per boot,
  mencegah duplikat saat retry.
- Antrian NVS maksimum 500 entri; entri tertua dibuang bila penuh
  (tercatat di serial, perlu monitoring).
