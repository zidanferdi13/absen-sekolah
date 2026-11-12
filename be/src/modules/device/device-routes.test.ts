import { beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../lib/env.js';
import deviceAuthPlugin from '../../plugins/device-auth.js';
import deviceRoutes from './routes.js';

// Fokus test ini adalah urutan hook deviceAuth vs rate limit, bukan isi rekap tap.
vi.mock('./tap.service.js', () => ({
  handleTap: vi.fn(async () => ({
    decision: 'ACCEPTED',
    tapType: 'CLOCK_IN',
    person: null,
    status: 'HADIR',
    message: 'Tap diterima',
    serverTime: new Date().toISOString(),
  })),
}));

const DEVICE_CODE = 'TEST-DEV-01';
const DEVICE_KEY = 'kunci-device-tes';

let apiKeyHash = '';

function createApp(): FastifyInstance {
  const prisma = {
    device: {
      findUnique: async ({ where }: { where: { code: string } }) =>
        where.code === DEVICE_CODE
          ? { id: 'dev-1', code: DEVICE_CODE, status: 'ACTIVE', apiKeyHash }
          : null,
      update: async () => ({}),
    },
    tapLog: { findUnique: async () => null },
  } as unknown as PrismaClient;

  const app = Fastify();
  app.decorate('prisma', prisma);
  app.register(rateLimit, { global: false });
  app.register(deviceAuthPlugin);
  app.register(deviceRoutes);
  return app;
}

function tapRequest(key: string, idempotencyKey: string) {
  return {
    method: 'POST' as const,
    url: '/device/tap',
    headers: { 'x-device-code': DEVICE_CODE, 'x-device-key': key },
    payload: { uid: 'A1B2C3D4', idempotencyKey },
  };
}

beforeAll(async () => {
  apiKeyHash = await bcrypt.hash(DEVICE_KEY, 4);
});

describe('POST /device/tap', () => {
  it('tidak membalas 500 saat device key sah', async () => {
    const app = createApp();

    const response = await app.inject(tapRequest(DEVICE_KEY, 'tap-valid'));
    await app.close();

    expect(response.statusCode).toBe(200);
  });

  it('tetap menolak device key yang salah', async () => {
    const app = createApp();

    const response = await app.inject(tapRequest('kunci-salah', 'tap-invalid'));
    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it('membalas 429 pada tap melebihi batas per menit', async () => {
    const app = createApp();
    const max = env.DEVICE_RATE_LIMIT_PER_MINUTE;

    for (let i = 0; i < max; i += 1) {
      const allowed = await app.inject(tapRequest(DEVICE_KEY, `tap-${i}`));
      expect(allowed.statusCode).toBe(200);
    }

    const limited = await app.inject(tapRequest(DEVICE_KEY, `tap-${max}`));
    await app.close();

    expect(limited.statusCode).toBe(429);
  });
});
