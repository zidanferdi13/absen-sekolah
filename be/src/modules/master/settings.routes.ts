import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../../lib/audit.js';

export const LOGO_KEY = 'school.logo';
export const LOGO_MAX_CHARS = 400_000;
const SETTING_VALUE_MAX = 500;

const itemSchema = z
  .object({
    key: z.string().min(1).max(80),
    value: z.string(),
  })
  .superRefine((item, ctx) => {
    if (item.key === LOGO_KEY) {
      if (item.value.length === 0) return;
      if (item.value.length > LOGO_MAX_CHARS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Logo terlalu besar. Maksimum ${Math.round(LOGO_MAX_CHARS / 1000)} KB setelah encode base64.`,
        });
        return;
      }
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(item.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Logo harus berupa data URI PNG, JPEG, atau WebP (base64).',
        });
      }
      return;
    }

    if (item.value.length > SETTING_VALUE_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Nilai pengaturan maksimal ${SETTING_VALUE_MAX} karakter.`,
      });
    }
  });

const upsertSchema = z.object({
  settings: z.array(itemSchema).min(1),
});

export default async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings/branding', async (_request, reply) => {
    const rows = await app.prisma.setting.findMany({
      where: { key: { in: ['school.name', 'school.logo'] } },
    });
    const map = new Map(rows.map((row) => [row.key, row.value]));

    return reply
      .header('Cache-Control', 'public, max-age=60')
      .send({
        schoolName: map.get('school.name') ?? 'Sekolah',
        logo: map.get('school.logo') ?? null,
      });
  });

  app.get('/settings', { preHandler: app.authenticate }, async (_request, reply) => {
    const rows = await app.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return reply.send({ data: map });
  });

  app.put(
    '/settings',
    {
      preHandler: app.requireRole('ADMIN', 'SUPER_ADMIN'),
      bodyLimit: 1024 * 1024,
    },
    async (request, reply) => {
      const parsed = upsertSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.issues },
        });
      }

      const before = await app.prisma.setting.findMany({
        where: { key: { in: parsed.data.settings.map((s) => s.key) } },
      });

      await app.prisma.$transaction(
        parsed.data.settings.map((item) =>
          app.prisma.setting.upsert({
            where: { key: item.key },
            create: { key: item.key, value: item.value },
            update: { value: item.value },
          }),
        ),
      );

      const auditSafe = (value: string | undefined) =>
        value && value.length > 200 ? `<${value.length} chars>` : value;

      await writeAuditLog(app.prisma, {
        actorUserId: request.user.sub,
        action: 'settings.update',
        entity: 'Setting',
        entityId: parsed.data.settings.map((s) => s.key).join(','),
        before: before.map((row) => ({ key: row.key, value: auditSafe(row.value) })),
        after: parsed.data.settings.map((item) => ({
          key: item.key,
          value: auditSafe(item.value),
        })),
        ip: request.ip,
      });

      const rows = await app.prisma.setting.findMany({ orderBy: { key: 'asc' } });
      const map: Record<string, string> = {};
      for (const row of rows) map[row.key] = row.value;
      return reply.send({ data: map });
    },
  );
}
