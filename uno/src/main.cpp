#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <time.h>

#include "config.h"
#include "device_config.h"
#include "display.h"
#include "net.h"
#include "provisioning.h"
#include "rfid.h"

namespace {

constexpr const char *kFirmwareVersion = "1.0.0";

Display display;
RfidReader rfid;
DeviceConfig deviceConfig;

TapClient *client = nullptr;
ProvisioningPortal *portal = nullptr;

uint32_t seq = 0;

unsigned long lastHeartbeatAt = 0;
unsigned long lastStatusRefreshAt = 0;
unsigned long resultShownAt = 0;
unsigned long bootPressedAt = 0;
bool showingResult = false;
bool bootHeld = false;
bool portalStarted = false;

bool pressedBootButton() {
  if (digitalRead(BOOT_BUTTON_PIN) != LOW) {
    bootPressedAt = 0;
    return false;
  }

  if (bootPressedAt == 0) {
    bootPressedAt = millis();
    return false;
  }

  if (!bootHeld && millis() - bootPressedAt > BOOT_HOLD_MS) {
    bootHeld = true;
    return true;
  }
  return false;
}

void connectWifi() {
  if (deviceConfig.ssid().length() == 0) {
    Serial.println("[WIFI] SSID belum dikonfigurasi");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(deviceConfig.code().c_str());
  WiFi.begin(deviceConfig.ssid().c_str(), deviceConfig.pass().c_str());

  Serial.printf("[WIFI] Menghubungkan ke %s", deviceConfig.ssid().c_str());
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(400);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] Terhubung, IP %s\n", WiFi.localIP().toString().c_str());
    configTime(7 * 3600, 0, "id.pool.ntp.org", "time.google.com");
  } else {
    Serial.println("[WIFI] Gagal terhubung, mode offline");
  }
}

void startPortal() {
  if (portalStarted) return;
  portalStarted = true;
  showingResult = false;

  String apName = "Absensi-Setup-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  apName.toUpperCase();
  display.showProvisioning(apName);

  portal = new ProvisioningPortal(deviceConfig);
  portal->begin();
  Serial.println("[PROV] Mode setup aktif, tahan BOOT 3 detik untuk keluar");
}

void stopPortal() {
  if (!portalStarted) return;
  portal->stop();
  delete portal;
  portal = nullptr;
  portalStarted = false;
  Serial.println("[PROV] Mode setup selesai");
}

String statusLine() {
  uint32_t pending = client ? client->pendingCount() : 0;
  if (WiFi.status() != WL_CONNECTED) {
    return pending > 0 ? "Offline - " + String(pending) + " tap menunggu" : "Offline - tap disimpan";
  }
  if (pending > 0) {
    return "Online - " + String(pending) + " tap menunggu";
  }
  return "Online";
}

uint16_t statusColor() {
  return WiFi.status() == WL_CONNECTED ? GREEN : ORANGE;
}

void refreshIdleScreen() {
  display.showIdle(statusLine(), statusColor());
}

String nextIdempotencyKey() {
  seq += 1;
  return String(deviceConfig.code()) + ":" + String(deviceConfig.bootCount()) + ":" + String(seq);
}

TapView buildView(const TapResult &result) {
  TapView view;

  if (!result.ok) {
    view.line1 = "TAP TERSIMPAN";
    view.line2 = "Akan dikirim saat online";
    view.line3 = result.message;
    view.color = ORANGE;
    return view;
  }

  if (result.decision == "UNKNOWN_CARD") {
    view.line1 = "KARTU TIDAK DIKENAL";
    view.line2 = "";
    view.line3 = "Hubungi admin";
    view.color = RED;
    return view;
  }

  if (result.decision == "DUPLICATE") {
    view.line1 = result.name.length() ? result.name : "KARTU BARU SAJA DI-TAP";
    view.line2 = result.className;
    view.line3 = "Tunggu sebentar";
    view.color = ORANGE;
    return view;
  }

  if (result.decision == "REJECTED") {
    view.line1 = result.name.length() ? result.name : "DI LUAR JAM";
    view.line2 = result.className;
    view.line3 = "Di luar jam absensi";
    view.color = YELLOW;
    return view;
  }

  view.line1 = result.name;
  view.line2 = result.className;
  view.line3 = result.tapType == "PRAYER" ? "Tap Sholat" : result.tapType;
  if (result.status.length()) {
    view.line3 += " - " + result.status;
  }
  view.color = (result.status == "TERLAMBAT") ? YELLOW : GREEN;
  return view;
}

void handleTap() {
  String uid;
  if (!rfid.read(uid)) return;

  Serial.printf("[TAP] UID %s\n", uid.c_str());
  display.showReading();

  TapResult result = client->sendTap(uid, nextIdempotencyKey());
  Serial.printf("[TAP] decision=%s type=%s\n", result.decision.c_str(), result.tapType.c_str());

  display.showResult(buildView(result));
  showingResult = true;
  resultShownAt = millis();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== TAPRES - ESP32-S3 Tap Device ===");

  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

  deviceConfig.load();
  Serial.printf("[CFG] device=%s be=%s\n", deviceConfig.code().c_str(),
                deviceConfig.beUrl().c_str());

  display.begin();
  rfid.begin();

  client = new TapClient(deviceConfig.beUrl(), deviceConfig.code(), deviceConfig.key());

  if (!deviceConfig.isProvisioned()) {
    Serial.println("[CFG] Belum terprovisioning, masuk mode setup");
    startPortal();
    return;
  }

  connectWifi();

  if (WiFi.status() == WL_CONNECTED) {
    String schoolName = client->fetchSchoolName();
    if (schoolName.length() > 0) {
      display.setSchoolName(schoolName);
      Serial.printf("[CFG] sekolah: %s\n", schoolName.c_str());
    }

    int flushed = client->flushQueue();
    if (flushed > 0) Serial.printf("[QUEUE] %d tap terkirim\n", flushed);
  }

  refreshIdleScreen();
}

void loop() {
  if (pressedBootButton()) {
    bootHeld = false;
    if (portalStarted) {
      stopPortal();
      connectWifi();
      refreshIdleScreen();
    } else {
      startPortal();
    }
  }

  if (digitalRead(BOOT_BUTTON_PIN) == HIGH) {
    bootHeld = false;
  }

  if (portalStarted) {
    portal->loop();

    if (portal->isSaved()) {
      delay(1200);
      stopPortal();
      ESP.restart();
    } else if (portal->isTimedOut()) {
      Serial.println("[PROV] Timeout, keluar dari mode setup");
      stopPortal();
      connectWifi();
      refreshIdleScreen();
    }
    return;
  }

  if (showingResult && millis() - resultShownAt > LCD_RESULT_HOLD_MS) {
    showingResult = false;
    refreshIdleScreen();
    lastStatusRefreshAt = millis();
  }

  if (!showingResult) {
    handleTap();
  }

  if (millis() - lastHeartbeatAt > HEARTBEAT_MS) {
    lastHeartbeatAt = millis();
    client->heartbeat(kFirmwareVersion);

    if (WiFi.status() == WL_CONNECTED) {
      int flushed = client->flushQueue();
      if (flushed > 0) Serial.printf("[QUEUE] %d tap terkirim\n", flushed);
    } else {
      WiFi.reconnect();
      if (!showingResult) refreshIdleScreen();
    }
  }

  if (!showingResult && millis() - lastStatusRefreshAt > 30000) {
    lastStatusRefreshAt = millis();
    refreshIdleScreen();
  }

  delay(50);
}
