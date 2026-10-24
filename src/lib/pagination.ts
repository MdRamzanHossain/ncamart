import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function parsePagination(searchParams: URLSearchParams | Record<string, unknown>): {
  page: number;
  limit: number;
  offset: number;
} {
  const raw =
    searchParams instanceof URLSearchParams
      ? Object.fromEntries(searchParams.entries())
      : searchParams;

  const parsed = paginationQuerySchema.parse(raw);
  const offset = (parsed.page - 1) * parsed.limit;

  return {
    page: parsed.page,
    limit: parsed.limit,
    offset,
  };
}

export function buildPaginationMeta(
  totalCount: number,
  page: number,
  limit: number
): PaginationMeta {
  const safeTotal = Math.max(0, totalCount);
  const totalPages = Math.ceil(safeTotal / limit) || 1;

  return {
    page,
    limit,
    total_count: safeTotal,
    total_pages: totalPages,
  };
}

export function toPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return {
    items,
    pagination: buildPaginationMeta(totalCount, page, limit),
  };
}
