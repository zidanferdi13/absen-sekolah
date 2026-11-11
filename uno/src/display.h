#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Arduino_GFX_Library.h>
#include "config.h"

// TCA9554 I/O expander (0x20) — dipakai board untuk LCD CS/RST dan backlight.
// Diimplementasikan minimal agar tidak butuh library tambahan.
#define TCA9554_ADDR 0x20
#define TCA_REG_OUTPUT 0x01
#define TCA_REG_CONFIG 0x03

static void tcaWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(TCA9554_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

struct TapView {
  String line1;   // nama
  String line2;   // kelas / NIS
  String line3;   // status / pesan
  uint16_t color;
};

class Display {
public:
  void begin() {
    Wire.begin(I2C_SDA, I2C_SCL);

    // P1 sebagai output untuk LCD_RST, P7 untuk backlight (sesuai board).
    tcaWrite(TCA_REG_CONFIG, 0x00);

    resetPanel();

    bus_ = new Arduino_ESP32SPI(LCD_DC, GFX_NOT_DEFINED, LCD_SPI_SCLK, LCD_SPI_MOSI,
                                LCD_SPI_MISO);
    gfx_ = new Arduino_ST7796(bus_, GFX_NOT_DEFINED, 0, true, LCD_HOR_RES, LCD_VER_RES);

    if (!gfx_->begin()) {
      Serial.println("[LCD] gfx->begin() gagal");
      return;
    }

    gfx_->fillScreen(BLACK);
    setBacklight(true);
    ready_ = true;

    showIdle();
  }

  // Nama sekolah dikirim backend lewat /device/bootstrap, bukan hardcode,
  // supaya firmware yang sama bisa dipakai di sekolah mana pun.
  void setSchoolName(const String &name) {
    schoolName_ = name.length() > 0 ? name : String("TAPRES");
    schoolName_.toUpperCase();
  }

  const String &schoolName() const { return schoolName_; }

  void showIdle(const String &statusLine = "", uint16_t statusColor = 0x7BEF) {
    if (!ready_) return;
    gfx_->fillScreen(BLACK);
    drawHeader(schoolName_.c_str());
    centered("Tempelkan kartu", 200, WHITE, 3);
    centered("RFID", 245, 0x7BEF, 2);
    if (statusLine.length() > 0) {
      centered(statusLine, 330, statusColor, 2);
    }
  }

  void showProvisioning(const String &apName) {
    if (!ready_) return;
    gfx_->fillScreen(BLACK);
    drawHeader("MODE SETUP");
    centered("Device belum dikonfigurasi", 150, WHITE, 2);
    centered("Sambungkan ke WiFi:", 200, 0x7BEF, 2);
    centered(apName, 240, YELLOW, 2);
    centered("Lalu buka 192.168.4.1", 300, 0x7BEF, 2);
  }

  void showReading() {
    if (!ready_) return;
    gfx_->fillRect(0, 150, LCD_HOR_RES, 180, BLACK);
    centered("Membaca kartu...", 220, YELLOW, 3);
  }

  void showResult(const TapView &view) {
    if (!ready_) return;
    gfx_->fillScreen(BLACK);
    drawHeader("HASIL TAP");
    centered(view.line1, 160, view.color, 4);
    centered(view.line2, 220, WHITE, 2);
    centered(view.line3, 270, view.color, 2);
  }

  void showError(const String &message) {
    if (!ready_) return;
    gfx_->fillScreen(BLACK);
    drawHeader("ERROR");
    centered(message, 220, RED, 2);
  }

  void setBacklight(bool on) {
    // Backlight board dikendalikan langsung via GPIO 6 pada demo Waveshare.
    pinMode(LCD_BL, OUTPUT);
    digitalWrite(LCD_BL, on ? HIGH : LOW);
  }

private:
  Arduino_DataBus *bus_ = nullptr;
  Arduino_GFX *gfx_ = nullptr;
  bool ready_ = false;
  String schoolName_ = "TAPRES";

  void resetPanel() {
    tcaWrite(TCA_REG_OUTPUT, 0x00);
    delay(10);
    tcaWrite(TCA_REG_OUTPUT, 0x02);
    delay(10);
    tcaWrite(TCA_REG_OUTPUT, 0x00);
    delay(200);
  }

  void drawHeader(const char *title) {
    gfx_->fillRect(0, 0, LCD_HOR_RES, 70, 0x1A3A8F);
    gfx_->setTextSize(2);
    gfx_->setTextColor(WHITE);
    int16_t x1, y1;
    uint16_t w, h;
    gfx_->getTextBounds(title, 0, 0, &x1, &y1, &w, &h);
    gfx_->setCursor((LCD_HOR_RES - w) / 2, 30);
    gfx_->print(title);
    gfx_->drawFastHLine(0, 72, LCD_HOR_RES, 0x3B6EF6);
  }

  void centered(const String &text, int y, uint16_t color, uint8_t size) {
    if (text.length() == 0) return;
    gfx_->setTextSize(size);
    gfx_->setTextColor(color);
    int16_t x1, y1;
    uint16_t w, h;
    gfx_->getTextBounds(text.c_str(), 0, 0, &x1, &y1, &w, &h);
    int x = (LCD_HOR_RES - static_cast<int>(w)) / 2;
    if (x < 4) x = 4;
    gfx_->setCursor(x, y);
    gfx_->print(text);
  }
};
