#pragma once

#include <Arduino.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WiFi.h>

#include "device_config.h"

// Captive portal untuk provisioning awal.
// Aktif bila device belum punya konfigurasi, atau saat tombol BOOT ditahan.
class ProvisioningPortal {
public:
  explicit ProvisioningPortal(DeviceConfig &config) : config_(config), server_(80) {}

  void begin() {
    String apSsid = "Absensi-Setup-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    apSsid.toUpperCase();

    WiFi.mode(WIFI_AP);
    WiFi.softAP(apSsid.c_str());
    delay(200);

    Serial.printf("[PROV] AP aktif: %s\n", apSsid.c_str());
    Serial.printf("[PROV] Buka http://%s\n", WiFi.softAPIP().toString().c_str());

    dns_.start(53, "*", WiFi.softAPIP());

    server_.on("/", HTTP_GET, [this]() { handleForm(); });
    server_.on("/save", HTTP_POST, [this]() { handleSave(); });
    server_.onNotFound([this]() { handleForm(); });

    server_.begin();
    startedAt_ = millis();
    active_ = true;
  }

  void loop() {
    if (!active_) return;
    dns_.processNextRequest();
    server_.handleClient();
  }

  bool isActive() const { return active_; }
  bool isSaved() const { return saved_; }
  bool isTimedOut() const { return active_ && (millis() - startedAt_ > PROVISION_TIMEOUT_MS); }

  void stop() {
    if (!active_) return;
    server_.stop();
    dns_.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    active_ = false;
  }

private:
  DeviceConfig &config_;
  WebServer server_;
  DNSServer dns_;
  bool active_ = false;
  bool saved_ = false;
  unsigned long startedAt_ = 0;

  String page(const String &notice = "") {
    String html;
    html.reserve(2200);
    html += F("<!doctype html><html lang=id><head><meta charset=utf-8>");
    html += F("<meta name=viewport content='width=device-width,initial-scale=1'>");
    html += F("<title>Setup Absensi</title><style>");
    html += F("body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f8fafc}");
    html += F(".card{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;");
    html += F("border-radius:12px;padding:20px}h1{font-size:18px;margin:0 0 4px}");
    html += F("p.sub{color:#64748b;font-size:13px;margin:0 0 18px}");
    html += F("label{display:block;font-size:12px;color:#475569;margin:12px 0 4px}");
    html += F("input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #cbd5e1;");
    html += F("border-radius:7px;font-size:14px}button{margin-top:18px;width:100%;padding:11px;");
    html += F("border:0;border-radius:7px;background:#3b6ef6;color:#fff;font-size:14px;font-weight:600}");
    html += F(".notice{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:10px;");
    html += F("border-radius:7px;font-size:13px;margin-bottom:14px}");
    html += F(".hint{font-size:11px;color:#94a3b8;margin-top:6px}</style></head><body><div class=card>");
    html += F("<h1>Setup Device Absensi</h1><p class=sub>Konfigurasi WiFi dan koneksi backend.</p>");

    if (notice.length() > 0) {
      html += F("<div class=notice>");
      html += notice;
      html += F("</div>");
    }

    html += F("<form method=POST action=/save>");
    html += F("<label>SSID WiFi</label><input name=ssid required value='");
    html += config_.ssid();
    html += F("'>");
    html += F("<label>Password WiFi</label><input name=pass type=password value='");
    html += config_.pass();
    html += F("'>");
    html += F("<label>URL Backend</label><input name=beUrl required value='");
    html += config_.beUrl();
    html += F("'><div class=hint>Contoh: https://api.sekolah.id</div>");
    html += F("<label>Kode Device</label><input name=devCode required value='");
    html += config_.code();
    html += F("'><div class=hint>Harus sama dengan kode di dashboard, mis. GATE-01.</div>");
    html += F("<label>Device Key</label><input name=devKey required value='");
    html += config_.key();
    html += F("'><div class=hint>API key dari menu Perangkat di dashboard.</div>");
    html += F("<button type=submit>Simpan &amp; Hubungkan</button></form></div></body></html>");
    return html;
  }

  void handleForm() {
    server_.send(200, "text/html; charset=utf-8", page());
  }

  void handleSave() {
    String ssid = server_.arg("ssid");
    String pass = server_.arg("pass");
    String beUrl = server_.arg("beUrl");
    String code = server_.arg("devCode");
    String key = server_.arg("devKey");

    ssid.trim();
    beUrl.trim();
    code.trim();
    key.trim();

    if (ssid.length() == 0 || beUrl.length() == 0 || code.length() == 0) {
      server_.send(400, "text/html; charset=utf-8",
                   page("SSID, URL backend, dan kode device wajib diisi."));
      return;
    }

    if (!beUrl.startsWith("http://") && !beUrl.startsWith("https://")) {
      server_.send(400, "text/html; charset=utf-8",
                   page("URL backend harus diawali http:// atau https://"));
      return;
    }

    if (!config_.save(ssid, pass, beUrl, code, key)) {
      server_.send(500, "text/html; charset=utf-8", page("Gagal menyimpan ke NVS. Coba lagi."));
      return;
    }

    saved_ = true;
    server_.send(200, "text/html; charset=utf-8",
                 page("Tersimpan. Device akan restart dan mencoba terhubung."));
  }
};
