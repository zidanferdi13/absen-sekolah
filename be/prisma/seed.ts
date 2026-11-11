import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SETTINGS = [
  { key: 'school.name', value: 'SMKN 2 Tanjung Raya' },
  { key: 'school.startMinute', value: '420' },
  { key: 'school.graceMinutes', value: '15' },
];

const RULES = [
  {
    name: 'Masuk Pagi',
    type: 'CLOCK_IN' as const,
    prayerSlot: null,
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 6 * 60,
    endMinute: 7 * 60 + 15,
    priority: 0,
    minGapMinutes: 2,
  },
  {
    name: 'Pulang Sekolah',
    type: 'CLOCK_OUT' as const,
    prayerSlot: null,
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 13 * 60,
    endMinute: 16 * 60,
    priority: 0,
    minGapMinutes: 2,
  },
  {
    name: 'Sholat Dhuha',
    type: 'PRAYER' as const,
    prayerSlot: 'DHUHA' as const,
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 9 * 60 + 30,
    endMinute: 10 * 60 + 15,
    priority: 10,
    minGapMinutes: 1,
  },
  {
    name: 'Sholat Dhuhur',
    type: 'PRAYER' as const,
    prayerSlot: 'DHUHUR' as const,
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 11 * 60 + 45,
    endMinute: 12 * 60 + 45,
    priority: 10,
    minGapMinutes: 1,
  },
  {
    name: 'Sholat Ashar',
    type: 'PRAYER' as const,
    prayerSlot: 'ASHAR' as const,
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 15 * 60,
    endMinute: 15 * 60 + 45,
    priority: 10,
    minGapMinutes: 1,
  },
  {
    name: 'Tap Ekstrakurikuler',
    type: 'OTHER' as const,
    prayerSlot: null,
    daysOfWeek: [6],
    startMinute: 7 * 60,
    endMinute: 12 * 60,
    priority: 0,
    minGapMinutes: 2,
  },
];

const STUDENTS = [
  { nis: '2501001', fullName: 'Ahmad Fauzi', gender: 'L', level: '7A', uid: 'A0000001' },
  { nis: '2501002', fullName: 'Budi Santoso', gender: 'L', level: '7A', uid: 'A0000002' },
  { nis: '2501003', fullName: 'Citra Dewi', gender: 'P', level: '7A', uid: 'A0000003' },
  { nis: '2501004', fullName: 'Dian Pratama', gender: 'L', level: '7A', uid: 'A0000004' },
  { nis: '2502001', fullName: 'Eka Rahmawati', gender: 'P', level: '8A', uid: 'A0000005' },
  { nis: '2502002', fullName: 'Fajar Nugroho', gender: 'L', level: '8A', uid: 'A0000006' },
  { nis: '2502003', fullName: 'Gita Purnama', gender: 'P', level: '8A', uid: 'A0000007' },
  { nis: '2503001', fullName: 'Hadi Wijaya', gender: 'L', level: '9A', uid: 'A0000008' },
  { nis: '2503002', fullName: 'Indah Sari', gender: 'P', level: '9A', uid: 'A0000009' },
  { nis: '2503003', fullName: 'Joko Susilo', gender: 'L', level: '9A', uid: 'A0000010' },
];

const TEACHERS = [
  { nip: '198501012010011001', fullName: 'Siti Aminah', gender: 'P', uid: 'B0000001' },
  { nip: '198703152011011002', fullName: 'Bambang Sutrisno', gender: 'L', uid: 'B0000002' },
];

const DEVICES = [
  { code: 'GATE-01', name: 'Gerbang Utama', key: 'dev-key-gate-01' },
  { code: 'GATE-02', name: 'Gerbang Belakang', key: 'dev-key-gate-02' },
  { code: 'GATE-03', name: 'Lobi', key: 'dev-key-gate-03' },
];

async function main() {
  for (const item of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: item.key },
      create: item,
      update: {},
    });
  }

  const year = await prisma.academicYear.upsert({
    where: { name: '2025/2026' },
    create: {
      name: '2025/2026',
      startDate: new Date('2025-07-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      isActive: true,
    },
    update: {},
  });

  const classMap = new Map<string, string>();
  for (const [name, level] of [
    ['7A', '7'],
    ['8A', '8'],
    ['9A', '9'],
  ] as const) {
    const room = await prisma.classRoom.upsert({
      where: { academicYearId_name: { academicYearId: year.id, name } },
      create: { academicYearId: year.id, name, level },
      update: {},
    });
    classMap.set(name, room.id);
  }

  for (const student of STUDENTS) {
    const person = await prisma.person.upsert({
      where: { nis: student.nis },
      create: {
        type: 'STUDENT',
        nis: student.nis,
        fullName: student.fullName,
        gender: student.gender,
        classId: classMap.get(student.level) ?? null,
      },
      update: {},
    });

    await prisma.rfidCard.upsert({
      where: { uid: student.uid },
      create: {
        uid: student.uid,
        personId: person.id,
        status: 'ACTIVE',
        assignedAt: new Date(),
        label: `Kartu ${student.fullName}`,
      },
      update: {},
    });
  }

  for (const teacher of TEACHERS) {
    const person = await prisma.person.upsert({
      where: { nip: teacher.nip },
      create: {
        type: 'TEACHER',
        nip: teacher.nip,
        fullName: teacher.fullName,
        gender: teacher.gender,
      },
      update: {},
    });

    await prisma.rfidCard.upsert({
      where: { uid: teacher.uid },
      create: {
        uid: teacher.uid,
        personId: person.id,
        status: 'ACTIVE',
        assignedAt: new Date(),
        label: `Kartu ${teacher.fullName}`,
      },
      update: {},
    });
  }

  await prisma.user.upsert({
    where: { email: 'admin@sekolah.local' },
    create: {
      email: 'admin@sekolah.local',
      name: 'Administrator',
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash('Admin#12345', 10),
    },
    update: {},
  });

  for (const device of DEVICES) {
    await prisma.device.upsert({
      where: { code: device.code },
      create: {
        code: device.code,
        name: device.name,
        apiKeyHash: await bcrypt.hash(device.key, 10),
        status: 'ACTIVE',
      },
      update: {},
    });
  }

  for (const rule of RULES) {
    const existing = await prisma.tapRule.findFirst({ where: { name: rule.name, scope: 'GLOBAL' } });
    if (existing) continue;
    await prisma.tapRule.create({ data: { ...rule, scope: 'GLOBAL' } });
  }

  console.log('Seed selesai.');
  console.log(`Login: admin@sekolah.local / Admin#12345`);
  console.log('Device key dev: dev-key-gate-01, dev-key-gate-02, dev-key-gate-03');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
