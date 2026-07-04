/**
 * Standardized ActionResult type and helpers for all server actions.
 *
 * Pattern:
 *   - Server actions return ActionResult<T>
 *   - Client components check "error" in res (NOT res.ok) for TypeScript narrowing
 *   - Use ok() and err() helpers in action bodies
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Wrap a successful value. */
export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Wrap an error. Accepts Error objects or any value. */
export function err(e: unknown): ActionResult<never> {
  if (e instanceof Error) {
    // Don't leak internal Prisma / stack traces to the client
    const msg = e.message;
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return { ok: false, error: "A record with this value already exists." };
    }
    if (msg.includes("Foreign key constraint") || msg.includes("foreign key")) {
      return { ok: false, error: "This record is referenced by other data and cannot be deleted." };
    }
    if (msg.includes("Record to update not found") || msg.includes("Record to delete not found")) {
      return { ok: false, error: "Record not found." };
    }
    if (process.env.NODE_ENV === "development") return { ok: false, error: msg };
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
  if (typeof e === "string") return { ok: false, error: e };
  return { ok: false, error: "An unexpected error occurred." };
}

/**
 * Type guard — use in client components to narrow ActionResult.
 *
 * IMPORTANT: use "error" in res (not !res.ok) due to TypeScript narrowing
 * limitations in async callbacks inside startTransition.
 *
 * @example
 *   const res = await myAction();
 *   if ("error" in res) { setError(res.error); return; }
 *   // res.data is typed here
 */
export function isOk<T>(res: ActionResult<T>): res is { ok: true; data: T } {
  return res.ok;
}

/**
 * Pagination parameters for list queries.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export function parsePagination(params: PaginationParams): { skip: number; take: number; page: number } {
  const page = Math.max(1, params.page ?? 1);
  const take = Math.min(100, Math.max(1, params.pageSize ?? 25));
  return { skip: (page - 1) * take, take, page };
}

/**
 * Standard paginated response wrapper.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Safe Prisma BigInt serializer — converts BigInt → number for JSON.
 * Use when building response objects from Prisma models with BigInt ids.
 */
export function bigintToNumber(id: bigint | number): number {
  return typeof id === "bigint" ? Number(id) : id;
}
