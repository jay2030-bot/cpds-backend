export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Returned by controllers/services to control the response envelope. */
export class ApiResult<T = unknown> {
  constructor(
    public readonly data: T,
    public readonly message = 'Success',
    public readonly meta?: PaginationMeta,
  ) {}
}

export const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
