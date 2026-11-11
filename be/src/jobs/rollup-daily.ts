import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { recomputeRange } from '../modules/attendance/recompute.js';
import { SCHOOL_TZ, toDateKey } from '../lib/time.js';

const LOOKBACK_DAYS = 7;

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const prisma = new PrismaClient();
  const yesterday = shiftDays(toDateKey(new Date(), SCHOOL_TZ), -1);
  const from = shiftDays(yesterday, -(LOOKBACK_DAYS - 1));

  try {
    const result = await recomputeRange(prisma, { from, to: yesterday });
    console.log(
      `[rollup] ${from} .. ${yesterday} | persons=${result.persons} rows=${result.rows}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[rollup] gagal:', err);
  process.exit(1);
});
