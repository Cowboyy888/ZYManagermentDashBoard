"use client";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  total?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  total,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  if (totalPages <= 1 && !total) return null;

  const pages = buildPageList(page, totalPages);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Left: count info + page size selector */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {total !== undefined && (
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {total} record{total !== 1 ? "s" : ""}
          </span>
        )}
        {pageSize !== undefined && onPageSizeChange && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Per page:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: "3px 6px",
                borderRadius: 5,
                border: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text)",
                background: "var(--surface)",
              }}
            >
              {pageSizeOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: page buttons */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ‹
          </Button>

          {pages.map((p, i) =>
            p === "…" ? (
              <span key={i} style={{ padding: "4px 8px", fontSize: 12, color: "var(--text-3)" }}>…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "primary" : "secondary"}
                size="sm"
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </Button>
            )
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
