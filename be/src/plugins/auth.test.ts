import { describe, expect, it } from 'vitest';
import { parseTtlSeconds } from './auth.js';

describe('parseTtlSeconds()', () => {
  it('membaca detik tanpa unit', () => {
    expect(parseTtlSeconds('900', 60)).toBe(900);
  });

  it('membaca menit', () => {
    expect(parseTtlSeconds('15m', 60)).toBe(900);
  });

  it('membaca jam', () => {
    expect(parseTtlSeconds('2h', 60)).toBe(7200);
  });

  it('membaca hari', () => {
    expect(parseTtlSeconds('7d', 60)).toBe(604800);
  });

  it('menangani spasi di antara angka dan unit', () => {
    expect(parseTtlSeconds(' 30 m ', 60)).toBe(1800);
  });

  it('case-insensitive', () => {
    expect(parseTtlSeconds('1D', 60)).toBe(86400);
  });

  it('memakai fallback untuk format tidak dikenal', () => {
    expect(parseTtlSeconds('lima belas menit', 123)).toBe(123);
    expect(parseTtlSeconds('', 456)).toBe(456);
  });
});
