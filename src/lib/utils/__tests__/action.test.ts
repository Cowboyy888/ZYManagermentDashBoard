import { describe, it, expect, vi } from "vitest";
import { ok, err, isOk, parsePagination, paginated, bigintToNumber, type ActionResult } from "../action";

function getError(res: ActionResult<unknown>): string {
  if ("error" in res) return res.error;
  throw new Error("Expected error result, got ok");
}

// ─── ok() ────────────────────────────────────────────────────────────────────

describe("ok", () => {
  it("returns ok:true with data", () => {
    const res = ok({ id: 1, name: "Alice" });
    expect(res.ok).toBe(true);
    if (!("error" in res)) expect(res.data).toEqual({ id: 1, name: "Alice" });
  });
  it("works with void data", () => {
    const res = ok(undefined);
    expect(res.ok).toBe(true);
  });
});

// ─── err() ────────────────────────────────────────────────────────────────────

describe("err", () => {
  it("returns ok:false with string errors", () => {
    const res = err("Something went wrong");
    expect(res.ok).toBe(false);
    expect(getError(res)).toBe("Something went wrong");
  });

  it("sanitizes unique constraint errors", () => {
    const e = new Error("Unique constraint failed on the fields: (`email`)");
    expect(getError(err(e))).toBe("A record with this value already exists.");
  });

  it("sanitizes lowercase unique constraint", () => {
    const e = new Error("unique constraint violation");
    expect(getError(err(e))).toBe("A record with this value already exists.");
  });

  it("sanitizes foreign key constraint errors", () => {
    const e = new Error("Foreign key constraint failed on the field: `departmentId`");
    expect(getError(err(e))).toBe("This record is referenced by other data and cannot be deleted.");
  });

  it("sanitizes lowercase foreign key errors", () => {
    const e = new Error("foreign key constraint violation");
    expect(getError(err(e))).toBe("This record is referenced by other data and cannot be deleted.");
  });

  it("sanitizes record-not-found for update", () => {
    const e = new Error("Record to update not found.");
    expect(getError(err(e))).toBe("Record not found.");
  });

  it("sanitizes record-not-found for delete", () => {
    const e = new Error("Record to delete not found.");
    expect(getError(err(e))).toBe("Record not found.");
  });

  it("returns generic message for unknown Error in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = err(new Error("Internal database driver crashed"));
    expect(res.ok).toBe(false);
    expect(getError(res)).toBe("An unexpected error occurred. Please try again.");
    vi.unstubAllEnvs();
  });

  it("returns error message in development for unknown Error", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getError(err(new Error("Something obscure happened")))).toBe("Something obscure happened");
    vi.unstubAllEnvs();
  });

  it("handles non-Error, non-string throws", () => {
    const res = err({ code: 500 });
    expect(res.ok).toBe(false);
    expect(getError(res)).toBe("An unexpected error occurred.");
  });
});

// ─── isOk() ──────────────────────────────────────────────────────────────────

describe("isOk", () => {
  it("returns true for ok results", () => {
    expect(isOk(ok(42))).toBe(true);
  });
  it("returns false for error results", () => {
    expect(isOk(err("oops"))).toBe(false);
  });
});

// ─── parsePagination() ───────────────────────────────────────────────────────

describe("parsePagination", () => {
  it("defaults page=1, pageSize=25", () => {
    const p = parsePagination({});
    expect(p).toEqual({ skip: 0, take: 25, page: 1 });
  });
  it("computes correct skip for page 2", () => {
    const p = parsePagination({ page: 2, pageSize: 10 });
    expect(p).toEqual({ skip: 10, take: 10, page: 2 });
  });
  it("clamps pageSize max to 100", () => {
    const p = parsePagination({ pageSize: 500 });
    expect(p.take).toBe(100);
  });
  it("clamps pageSize min to 1", () => {
    const p = parsePagination({ pageSize: 0 });
    expect(p.take).toBe(1);
  });
  it("clamps page min to 1", () => {
    const p = parsePagination({ page: -5 });
    expect(p.page).toBe(1);
    expect(p.skip).toBe(0);
  });
});

// ─── paginated() ─────────────────────────────────────────────────────────────

describe("paginated", () => {
  const items = [1, 2, 3, 4, 5];

  it("computes totalPages correctly", () => {
    const r = paginated(items, 50, 1, 10);
    expect(r.totalPages).toBe(5);
  });
  it("sets hasNext on non-last page", () => {
    const r = paginated(items, 50, 1, 10);
    expect(r.hasNext).toBe(true);
    expect(r.hasPrev).toBe(false);
  });
  it("sets hasPrev on non-first page", () => {
    const r = paginated(items, 50, 3, 10);
    expect(r.hasPrev).toBe(true);
  });
  it("no hasNext on last page", () => {
    const r = paginated(items, 50, 5, 10);
    expect(r.hasNext).toBe(false);
  });
  it("ceil for non-divisible total", () => {
    const r = paginated([], 51, 1, 10);
    expect(r.totalPages).toBe(6);
  });
});

// ─── bigintToNumber() ────────────────────────────────────────────────────────

describe("bigintToNumber", () => {
  it("converts BigInt to number", () => {
    expect(bigintToNumber(BigInt(42))).toBe(42);
  });
  it("passes through regular numbers unchanged", () => {
    expect(bigintToNumber(100)).toBe(100);
  });
});
