import { describe, expect, it } from 'vitest';
import { normalizeUid } from './shared.js';
import { parsePagination, metaOf } from '../../lib/pagination.js';

describe('normalizeUid()', () => {
  it('menghapus separator dan menjadikan uppercase', () => {
    expect(normalizeUid(' a1:b2-c3 d4 ')).toBe('A1B2C3D4');
  });

  it('idempoten', () => {
    const once = normalizeUid('a1b2c3d4');
    expect(normalizeUid(once)).toBe(once);
  });
});

describe('parsePagination()', () => {
  it('memakai default page 1 limit 50', () => {
    const p = parsePagination({});
    expect(p).toMatchObject({ page: 1, limit: 50, skip: 0, take: 50 });
  });

  it('menghitung skip dari page', () => {
    const p = parsePagination({ page: '3', limit: '20' });
    expect(p).toMatchObject({ page: 3, limit: 20, skip: 40, take: 20 });
  });

  it('membatasi limit maksimal 200', () => {
    expect(() => parsePagination({ limit: '5000' })).toThrow();
  });

  it('metaOf menghasilkan total yang benar', () => {
    const p = parsePagination({ page: '2', limit: '10' });
    expect(metaOf(123, p)).toEqual({ page: 2, limit: 10, total: 123 });
  });
});
