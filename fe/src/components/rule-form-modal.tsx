'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';

export interface RuleFormState {
  name: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'PRAYER' | 'OTHER';
  prayerSlot: string;
  scope: 'GLOBAL' | 'CLASS';
  classId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  minGapMinutes: number;
  priority: number;
  isActive: boolean;
}

export const emptyRuleForm: RuleFormState = {
  name: '',
  type: 'CLOCK_IN',
  prayerSlot: '',
  scope: 'GLOBAL',
  classId: '',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '06:00',
  endTime: '07:15',
  minGapMinutes: 2,
  priority: 0,
  isActive: true,
};

export const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const toTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export const toMinute = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
};

export function RuleFormModal({
  open,
  onClose,
  editing,
  form,
  setForm,
  onSubmit,
  saving,
  error,
  classes,
}: {
  open: boolean;
  onClose: () => void;
  editing: boolean;
  form: RuleFormState;
  setForm: (next: RuleFormState) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
  classes: { id: string; name: string }[];
}) {
  const [drag, setDrag] = useState(false);

  function toggleDay(day: number) {
    setForm({
      ...form,
      daysOfWeek: form.daysOfWeek.includes(day)
        ? form.daysOfWeek.filter((value) => value !== day)
        : [...form.daysOfWeek, day].sort((a, b) => a - b),
    });
  }

  const invalid =
    !form.name.trim() ||
    form.daysOfWeek.length === 0 ||
    (form.scope === 'CLASS' && !form.classId) ||
    (form.type === 'PRAYER' && !form.prayerSlot);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Aturan' : 'Tambah Aturan'}
      description="Aturan menentukan satu tap dihitung sebagai Masuk, Pulang, Sholat, atau Lainnya."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={onSubmit} disabled={saving || invalid}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama aturan">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Masuk Pagi"
            />
          </Field>

          <Field label="Tipe tap">
            <Select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as RuleFormState['type'] })}
            >
              <option value="CLOCK_IN">Masuk</option>
              <option value="CLOCK_OUT">Pulang</option>
              <option value="PRAYER">Sholat</option>
              <option value="OTHER">Lainnya</option>
            </Select>
          </Field>
        </div>

        {form.type === 'PRAYER' && (
          <Field label="Slot sholat">
            <Select
              value={form.prayerSlot}
              onChange={(event) => setForm({ ...form, prayerSlot: event.target.value })}
            >
              <option value="">Pilih slot</option>
              <option value="DHUHA">Dhuha</option>
              <option value="DHUHUR">Dhuhur</option>
              <option value="ASHAR">Ashar</option>
            </Select>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Jam mulai">
            <Input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm({ ...form, startTime: event.target.value })}
            />
          </Field>

          <Field label="Jam selesai">
            <Input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm({ ...form, endTime: event.target.value })}
            />
          </Field>

          <Field label="Jeda min. (menit)" hint="Tap lebih cepat dianggap duplikat.">
            <Input
              type="number"
              min={0}
              max={120}
              value={form.minGapMinutes}
              onChange={(event) => setForm({ ...form, minGapMinutes: Number(event.target.value) })}
            />
          </Field>
        </div>

        <Field label="Hari berlaku">
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(index)}
                onMouseDown={() => setDrag(true)}
                onMouseUp={() => setDrag(false)}
                className={`inline-flex h-8 w-11 items-center justify-center rounded text-xs font-medium transition ${
                  form.daysOfWeek.includes(index)
                    ? 'bg-brand-500 text-white'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                } ${drag ? 'opacity-80' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Scope">
            <Select
              value={form.scope}
              onChange={(event) =>
                setForm({ ...form, scope: event.target.value as RuleFormState['scope'] })
              }
            >
              <option value="GLOBAL">Global (semua)</option>
              <option value="CLASS">Per kelas</option>
            </Select>
          </Field>

          {form.scope === 'CLASS' ? (
            <Field label="Kelas">
              <Select
                value={form.classId}
                onChange={(event) => setForm({ ...form, classId: event.target.value })}
              >
                <option value="">Pilih kelas</option>
                {classes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Status">
              <Select
                value={form.isActive ? '1' : '0'}
                onChange={(event) => setForm({ ...form, isActive: event.target.value === '1' })}
              >
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </Select>
            </Field>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prioritas" hint="Angka lebih besar menang bila window bertumpuk.">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })}
            />
          </Field>

          {form.scope === 'CLASS' && (
            <Field label="Status">
              <Select
                value={form.isActive ? '1' : '0'}
                onChange={(event) => setForm({ ...form, isActive: event.target.value === '1' })}
              >
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </Select>
            </Field>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
