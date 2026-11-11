#pragma once

// ---------------------------------------------------------------------------
// Pin map ESP32-S3-Touch-LCD-3.5
// Sumber: examples/arduino/examples/08_gfx_helloworld (repo resmi Waveshare)
// LCD_CS dan LCD_RST TIDAK ada di GPIO — dikendalikan TCA9554 via I2C.
// Karena itu RC522 WAJIB memakai bus SPI terpisah.
// ---------------------------------------------------------------------------

// Bus SPI LCD (FSPI) — jangan diubah
#define LCD_SPI_MOSI 1
#define LCD_SPI_MISO 2
#define LCD_SPI_SCLK 5
#define LCD_DC       3
#define LCD_BL       6
#define LCD_HOR_RES  320
#define LCD_VER_RES  480

// I2C internal board (touch, RTC, IMU, PMIC, expander)
#define I2C_SDA 8
#define I2C_SCL 7

// Bus SPI RC522 (HSPI) — pin bebas, tidak dipakai board
#define RFID_CS   10
#define RFID_SCK  12
#define RFID_MOSI 11
#define RFID_MISO 13
#define RFID_RST  14

// Perilaku
#define RFID_BAUD_HZ        4000000UL
#define TAP_DEBOUNCE_MS     2000UL
#define LCD_RESULT_HOLD_MS  3000UL
#define HEARTBEAT_MS        60000UL
#define HTTP_TIMEOUT_MS     5000

// Batas antrian offline (disimpan di NVS)
#define QUEUE_MAX 500

// Warna tambahan (Arduino_GFX sudah menyediakan WHITE/BLACK/RED/YELLOW/GREEN)
#ifndef ORANGE
#define ORANGE 0xFD20
#endif

// Provisioning
#define PROVISION_TIMEOUT_MS 600000UL
#define BOOT_BUTTON_PIN      0
#define BOOT_HOLD_MS         3000UL

// ---------------------------------------------------------------------------
// Konfigurasi runtime — diisi saat provisioning (captive portal)
// Nilai di bawah hanya default untuk development.
// ---------------------------------------------------------------------------
#define DEFAULT_WIFI_SSID ""
#define DEFAULT_WIFI_PASS ""
#define DEFAULT_BE_URL    "http://192.168.1.10:3001"
#define DEFAULT_DEV_CODE  "GATE-01"
#define DEFAULT_DEV_KEY   "change-me"
