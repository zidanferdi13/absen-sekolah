import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  SCHOOL_TIMEZONE: z.string().default('Asia/Jakarta'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DEVICE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(
    `Invalid environment variables:\n${issues}\n\n` +
      `Pastikan file be/.env ada. Buat dari template:\n` +
      `  cp .env.example .env\n` +
      `Lalu isi DATABASE_URL, JWT_ACCESS_SECRET, dan JWT_REFRESH_SECRET (minimal 16 karakter).`,
  );
}

export const env = parsed.data;
