import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export interface Pagination {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function parsePagination(query: unknown): Pagination {
  const { page, limit } = querySchema.parse(query ?? {});
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function metaOf(total: number, p: Pagination) {
  return { page: p.page, limit: p.limit, total };
}
