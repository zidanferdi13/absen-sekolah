#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "config.h"

// Satu sumber kebenaran untuk konfigurasi device.
// Dibaca dari NVS; jika kosong memakai default di config.h.
class DeviceConfig {
public:
  void load() {
    prefs_.begin("absen", true);
    ssid_ = prefs_.getString("ssid", DEFAULT_WIFI_SSID);
    pass_ = prefs_.getString("pass", DEFAULT_WIFI_PASS);
    beUrl_ = prefs_.getString("beUrl", DEFAULT_BE_URL);
    code_ = prefs_.getString("devCode", DEFAULT_DEV_CODE);
    key_ = prefs_.getString("devKey", DEFAULT_DEV_KEY);
    bootCount_ = prefs_.getUInt("boots", 0);
    prefs_.end();

    prefs_.begin("absen", false);
    bootCount_ += 1;
    prefs_.putUInt("boots", bootCount_);
    prefs_.end();
  }

  bool save(const String &ssid, const String &pass, const String &beUrl, const String &code,
            const String &key) {
    prefs_.begin("absen", false);
    bool ok = true;
    ok = prefs_.putString("ssid", ssid) > 0 && ok;
    ok = prefs_.putString("pass", pass) == pass.length() && ok;
    ok = prefs_.putString("beUrl", beUrl) > 0 && ok;
    ok = prefs_.putString("devCode", code) > 0 && ok;
    ok = prefs_.putString("devKey", key) > 0 && ok;
    prefs_.end();

    if (ok) {
      ssid_ = ssid;
      pass_ = pass;
      beUrl_ = beUrl;
      code_ = code;
      key_ = key;
    }
    return ok;
  }

  void clear() {
    prefs_.begin("absen", false);
    prefs_.clear();
    prefs_.end();
  }

  bool isProvisioned() const {
    return ssid_.length() > 0 && beUrl_.length() > 0 && code_.length() > 0 &&
           key_.length() > 0 && key_ != DEFAULT_DEV_KEY;
  }

  const String &ssid() const { return ssid_; }
  const String &pass() const { return pass_; }
  const String &beUrl() const { return beUrl_; }
  const String &code() const { return code_; }
  const String &key() const { return key_; }
  uint32_t bootCount() const { return bootCount_; }

private:
  Preferences prefs_;
  String ssid_;
  String pass_;
  String beUrl_;
  String code_;
  String key_;
  uint32_t bootCount_ = 0;
};
