import type { Prisma } from '@prisma/client';

export const normalizeUid = (uid: string): string =>
  uid
    .trim()
    .replace(/[\s:\-]/g, '')
    .toUpperCase();

export function personSelect() {
  return {
    id: true,
    type: true,
    nis: true,
    nip: true,
    fullName: true,
    gender: true,
    phone: true,
    photoUrl: true,
    isActive: true,
    classId: true,
    class: { select: { id: true, name: true, level: true } },
    cards: {
      where: { status: 'ACTIVE' as const },
      select: { id: true, uid: true, label: true, status: true },
    },
  } satisfies Prisma.PersonSelect;
}

export interface PersonListItem {
  id: string;
  nis: string | null;
  nip: string | null;
  fullName: string;
  className: string | null;
  isActive: boolean;
}

export function flattenPerson(person: {
  id: string;
  nis: string | null;
  nip: string | null;
  fullName: string;
  gender: string | null;
  phone: string | null;
  photoUrl: string | null;
  isActive: boolean;
  classId: string | null;
  class: { id: string; name: string; level: string } | null;
  cards: { id: string; uid: string; label: string | null; status: string }[];
}) {
  return {
    id: person.id,
    nis: person.nis,
    nip: person.nip,
    fullName: person.fullName,
    gender: person.gender,
    phone: person.phone,
    photoUrl: person.photoUrl,
    isActive: person.isActive,
    classId: person.classId,
    className: person.class?.name ?? null,
    cards: person.cards,
  };
}
