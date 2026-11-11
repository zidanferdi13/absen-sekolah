#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

#include "config.h"
#include "queue.h"

struct TapResult {
  bool ok = false;
  String decision;
  String tapType;
  String name;
  String className;
  String status;
  String message;
  int retryAfterSeconds = 0;
};

class TapClient {
public:
  TapClient(const String &baseUrl, const String &deviceCode, const String &deviceKey)
      : baseUrl_(baseUrl), deviceCode_(deviceCode), deviceKey_(deviceKey) {}

  TapResult sendTap(const String &uid, const String &idempotencyKey) {
    TapResult result;
    const String deviceTs = isoNow();

    if (WiFi.status() != WL_CONNECTED) {
      result.message = "Offline - tap disimpan";
      queue_.push(uid, idempotencyKey, deviceTs);
      return result;
    }

    String body;
    {
      JsonDocument doc;
      doc["uid"] = uid;
      doc["idempotencyKey"] = idempotencyKey;
      doc["deviceTs"] = deviceTs;
      serializeJson(doc, body);
    }

    HTTPClient http;
    if (!http.begin(String(baseUrl_) + "/api/v1/device/tap")) {
      result.message = "Gagal konek BE";
      queue_.push(uid, idempotencyKey, deviceTs);
      return result;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Code", deviceCode_);
    http.addHeader("X-Device-Key", deviceKey_);

    int code = http.POST(body);

    if (code != 200) {
      Serial.printf("[HTTP] tap gagal: %d\n", code);
      result.message = (code == 401) ? "Device key salah" : "Server error";
      if (code <= 0 || code >= 500) queue_.push(uid, idempotencyKey, deviceTs);
      http.end();
      return result;
    }

    String payload = http.getString();
    http.end();

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
      result.message = "Response tidak valid";
      return result;
    }

    result.ok = true;
    result.decision = doc["decision"].as<String>();
    result.tapType = doc["tapType"] | "";
    result.status = doc["status"] | "";
    result.message = doc["message"] | "";
    result.retryAfterSeconds = doc["retryAfterSeconds"] | 0;

    if (!doc["person"].isNull()) {
      result.name = doc["person"]["name"] | "";
      result.className = doc["person"]["className"] | "";
    }

    return result;
  }

  // Kirim ulang antrian offline. Mengembalikan jumlah yang berhasil.
  int flushQueue() {
    if (WiFi.status() != WL_CONNECTED || queue_.isEmpty()) return 0;

    JsonDocument doc;
    JsonArray taps = doc["taps"].to<JsonArray>();

    int count = 0;
    while (count < 100) {
      QueuedTap item;
      if (!queue_.peekAt(count, item)) break;
      JsonObject tap = taps.add<JsonObject>();
      tap["uid"] = item.uid;
      tap["idempotencyKey"] = item.idempotencyKey;
      if (item.deviceTs.length() > 0) tap["deviceTs"] = item.deviceTs;
      count++;
    }

    if (count == 0) return 0;

    String body;
    serializeJson(doc, body);

    HTTPClient http;
    if (!http.begin(String(baseUrl_) + "/api/v1/device/taps/batch")) return 0;
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Code", deviceCode_);
    http.addHeader("X-Device-Key", deviceKey_);

    int code = http.POST(body);
    http.end();

    if (code != 200) return 0;

    for (int i = 0; i < count; i++) queue_.pop();
    return count;
  }

  void heartbeat(const String &firmwareVersion) {
    if (WiFi.status() != WL_CONNECTED) return;

    String body;
    {
      JsonDocument doc;
      doc["firmwareVersion"] = firmwareVersion;
      doc["ip"] = WiFi.localIP().toString();
      doc["rssi"] = WiFi.RSSI();
      serializeJson(doc, body);
    }

    HTTPClient http;
    if (!http.begin(String(baseUrl_) + "/api/v1/device/heartbeat")) return;
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Code", deviceCode_);
    http.addHeader("X-Device-Key", deviceKey_);
    http.POST(body);
    http.end();
  }

  uint32_t pendingCount() const { return queue_.size(); }

  // Mengambil nama sekolah + timezone dari backend.
  // Mengembalikan string kosong bila gagal.
  String fetchSchoolName() {
    if (WiFi.status() != WL_CONNECTED) return "";

    HTTPClient http;
    if (!http.begin(String(baseUrl_) + "/api/v1/device/bootstrap")) return "";
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("X-Device-Code", deviceCode_);
    http.addHeader("X-Device-Key", deviceKey_);

    int code = http.GET();
    if (code != 200) {
      http.end();
      return "";
    }

    String payload = http.getString();
    http.end();

    JsonDocument doc;
    if (deserializeJson(doc, payload)) return "";

    return doc["schoolName"] | "";
  }

private:
  String baseUrl_;
  String deviceCode_;
  String deviceKey_;
  TapQueue queue_;

  static String isoNow() {
    // ESP32 tidak punya RTC baterai; waktu hanya untuk audit deviceTs.
    time_t now = time(nullptr);
    struct tm tmUtc;
    gmtime_r(&now, &tmUtc);
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmUtc);
    return String(buf);
  }
};
