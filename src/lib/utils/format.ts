/**
 * Shared formatting utilities — use these everywhere instead of inline formatters.
 * All functions are pure and safe for both server and client.
 */

// ─── Currency ────────────────────────────────────────────────────────────────

export function fmtUsd(amount: number | string | null | undefined, opts?: { compact?: boolean }): string {
  const n = Number(amount ?? 0);
  if (opts?.compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtKhr(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("km-KH", { style: "currency", currency: "KHR", maximumFractionDigits: 0 }).format(n);
}

export function fmtNumber(n: number | string | null | undefined, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n ?? 0));
}

export function fmtPercent(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(decimals)}%`;
}

export function fmtWeight(kg: number | string | null | undefined): string {
  const n = Number(kg ?? 0);
  if (n >= 1000) return `${(n / 1000).toFixed(2)} t`;
  return `${fmtNumber(n, 2)} kg`;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

export function fmtDate(date: Date | string | null | undefined, format: "short" | "medium" | "long" = "medium"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  switch (format) {
    case "short":  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    case "medium": return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    case "long":   return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  }
}

export function fmtDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function fmtRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return fmtDate(d, "medium");
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Names ───────────────────────────────────────────────────────────────────

export function fmtEmployeeName(
  nameEn: string,
  nameKh?: string | null,
  opts?: { preferKh?: boolean; showBoth?: boolean }
): string {
  if (opts?.showBoth && nameKh) return `${nameEn} (${nameKh})`;
  if (opts?.preferKh && nameKh) return nameKh;
  return nameEn;
}

export function fmtInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Files ───────────────────────────────────────────────────────────────────

export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ─── Status labels ────────────────────────────────────────────────────────────

export function fmtStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
