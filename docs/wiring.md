# Wiring — ESP32-S3-Touch-LCD-3.5 + RC522

Sumber pin LCD: `examples/arduino/examples/08_gfx_helloworld` (repo resmi Waveshare).
Terverifikasi dari source code, bukan asumsi.

## 1. Pin yang sudah dipakai board

| Fungsi | GPIO / Bus | Catatan |
| --- | --- | --- |
| SPI LCD — MOSI | GPIO 1 | FSPI |
| SPI LCD — MISO | GPIO 2 | FSPI |
| SPI LCD — SCLK | GPIO 5 | FSPI |
| LCD DC | GPIO 3 | strapping pin, sudah dipakai board |
| LCD CS | tidak ada GPIO | via TCA9554 (I2C 0x20) |
| LCD RST | tidak ada GPIO | via TCA9554 (I2C 0x20) pin P1 |
| Backlight | GPIO 6 | PWM |
| I2C SDA | GPIO 8 | touch FT6336, RTC, IMU, AXP2101, TCA9554 |
| I2C SCL | GPIO 7 | idem |
| USB D- / D+ | GPIO 19 / 20 | jangan dipakai |
| Strapping | GPIO 0, 3, 45, 46 | hindari untuk periferal baru |

**Kesimpulan penting:** `LCD_CS` dan `LCD_RST` tidak tersedia sebagai GPIO bebas.
Karena itu **RC522 wajib dipasang pada bus SPI terpisah**, jangan di-share
dengan bus LCD. Sharing akan menyebabkan race condition dan LCD glitch.

## 2. RC522 -> ESP32-S3 (bus SPI terpisah)

| RC522 | ESP32-S3 | Keterangan |
| --- | --- | --- |
| SDA (CS) | GPIO 10 | chip select |
| SCK | GPIO 12 | clock |
| MOSI | GPIO 11 | data ke reader |
| MISO | GPIO 13 | data dari reader |
| RST | GPIO 14 | boleh juga diikat ke 3V3 |
| VCC | 3V3 | **JANGAN 5V** — RC522 modul 3.3V |
| GND | GND | |
| IRQ | — | tidak dipakai (polling) |

### Catatan implementasi

- Gunakan `SPIClass rfidBus(HSPI)` lalu `rfidBus.begin(SCK, MISO, MOSI, CS)`.
- Turunkan clock SPI ke **4 MHz** bila reader tidak stabil (kabel panjang /
  antena dekat LCD).
- UID dinormalisasi: hex uppercase tanpa separator (`A1B2C3D4`).
- Debounce 2 detik per UID agar satu tap tidak terbaca berulang.
- Antena RC522 sebaiknya tidak menempel ke panel LCD; beri jarak minimal 2 cm
  dan jauhkan dari kabel backlight.
- Tarik daya RC522 dari 3V3 board; jika reader sering reset saat LCD menyala,
  tambahkan kapasitor 100 nF dekat pin 3V3 modul RC522.

## 3. Pin bebas lain (cadangan)

GPIO berikut tidak dipakai board dan aman untuk periferal tambahan
(buzzer, LED indikator, tombol): **15, 16, 17, 18, 21, 39, 40, 41, 42, 47, 48**.

Hindari: 4, 9 (kamera/SD), 38 (XCLK kamera), 43/44 (UART0), 19/20 (USB).

## 4. Checklist sebelum flashing

- [ ] RC522 diberi 3V3, bukan 5V.
- [ ] RC522 di bus SPI terpisah dari LCD.
- [ ] `rfidBus.begin(12, 13, 11, 10)` sesuai tabel.
- [ ] UID dinormalisasi hex uppercase sebelum dikirim.
- [ ] Sudah cek schematic V1/V2 sesuai marking PCB.
- [ ] Serial monitor 115200, USB CDC on boot aktif.
- [ ] Board setting Arduino IDE: ESP32S3 Dev Module, Flash 16MB,
      PSRAM OPI PSRAM, Partition 16M Flash (3MB APP/9.9MB FATFS).