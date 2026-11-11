#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include "config.h"

// RC522 pada bus SPI terpisah (HSPI) supaya tidak bentrok dengan LCD.
class RfidReader {
public:
  void begin() {
    bus_.begin(RFID_SCK, RFID_MISO, RFID_MOSI, RFID_CS);
    reader_.PCD_Init(RFID_CS, RFID_RST);

    // Verifikasi reader benar-benar terpasang.
    byte version = reader_.PCD_ReadRegister(MFRC522::VersionReg);
    if (version == 0x00 || version == 0xFF) {
      Serial.println("[RFID] Reader tidak terdeteksi. Cek wiring 3V3/SPI.");
      ready_ = false;
      return;
    }
    Serial.printf("[RFID] Siap (version 0x%02X)\n", version);

    reader_.PCD_SetAntennaGain(MFRC522::RxGain_max);
    ready_ = true;
  }

  bool isReady() const { return ready_; }

  // Mengembalikan true bila ada UID baru yang lolos debounce.
  // uid keluar dalam bentuk hex uppercase tanpa separator.
  bool read(String &uid) {
    if (!ready_) return false;

    if (!reader_.PICC_IsNewCardPresent()) return false;
    if (!reader_.PICC_ReadCardSerial()) return false;

    String candidate;
    candidate.reserve(reader_.uid.size * 2);
    for (byte i = 0; i < reader_.uid.size; i++) {
      if (reader_.uid.uidByte[i] < 0x10) candidate += '0';
      candidate += String(reader_.uid.uidByte[i], HEX);
    }
    candidate.toUpperCase();

    reader_.PICC_HaltA();
    reader_.PCD_StopCrypto1();

    if (isDuplicate(candidate)) return false;

    uid = candidate;
    return true;
  }

private:
  SPIClass bus_{HSPI};
  MFRC522 reader_;
  bool ready_ = false;

  String lastUid_;
  unsigned long lastAt_ = 0;

  bool isDuplicate(const String &uid) {
    unsigned long now = millis();
    if (uid == lastUid_ && (now - lastAt_) < TAP_DEBOUNCE_MS) {
      return true;
    }
    lastUid_ = uid;
    lastAt_ = now;
    return false;
  }
};
