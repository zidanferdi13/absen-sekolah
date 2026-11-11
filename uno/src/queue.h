#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

struct QueuedTap {
  String uid;
  String idempotencyKey;
  String deviceTs;
};

// Antrian tap saat offline, disimpan di NVS agar bertahan saat reboot.
// Kapasitas dibatasi QUEUE_MAX; entri tertua dibuang bila penuh.
class TapQueue {
public:
  TapQueue() { prefs_.begin("tapq", false); }

  void push(const String &uid, const String &key, const String &deviceTs) {
    uint32_t head = prefs_.getUInt("head", 0);
    uint32_t tail = prefs_.getUInt("tail", 0);
    uint32_t count = prefs_.getUInt("count", 0);

    if (count >= QUEUE_MAX) {
      head = (head + 1) % QUEUE_MAX;
      count = QUEUE_MAX - 1;
      Serial.println("[QUEUE] Penuh, entri tertua dibuang");
    }

    prefs_.putString(("u" + String(tail)).c_str(), uid);
    prefs_.putString(("k" + String(tail)).c_str(), key);
    prefs_.putString(("t" + String(tail)).c_str(), deviceTs);
    tail = (tail + 1) % QUEUE_MAX;
    count++;

    prefs_.putUInt("head", head);
    prefs_.putUInt("tail", tail);
    prefs_.putUInt("count", count);
  }

  bool peek(QueuedTap &out) const { return peekAt(0, out); }

  bool peekAt(uint32_t index, QueuedTap &out) const {
    uint32_t head = prefs_.getUInt("head", 0);
    uint32_t count = prefs_.getUInt("count", 0);
    if (index >= count) return false;

    uint32_t slot = (head + index) % QUEUE_MAX;
    out.uid = prefs_.getString(("u" + String(slot)).c_str(), "");
    out.idempotencyKey = prefs_.getString(("k" + String(slot)).c_str(), "");
    out.deviceTs = prefs_.getString(("t" + String(slot)).c_str(), "");
    return out.uid.length() > 0;
  }

  bool pop() {
    uint32_t head = prefs_.getUInt("head", 0);
    uint32_t count = prefs_.getUInt("count", 0);
    if (count == 0) return false;

    prefs_.remove(("u" + String(head)).c_str());
    prefs_.remove(("k" + String(head)).c_str());
    prefs_.remove(("t" + String(head)).c_str());

    head = (head + 1) % QUEUE_MAX;
    count--;
    prefs_.putUInt("head", head);
    prefs_.putUInt("count", count);
    return true;
  }

  bool isEmpty() const { return prefs_.getUInt("count", 0) == 0; }
  uint32_t size() const { return prefs_.getUInt("count", 0); }

private:
  mutable Preferences prefs_;
};
