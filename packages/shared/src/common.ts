import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type Sort = z.infer<typeof sortSchema>;

export const idParamSchema = z.object({
  id: z.string().cuid(),
});

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const orgRoleSchema = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'REP', 'READ_ONLY']);
export type OrgRole = z.infer<typeof orgRoleSchema>;
