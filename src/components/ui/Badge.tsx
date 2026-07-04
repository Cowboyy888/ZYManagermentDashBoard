import type { ReactNode } from "react";

export type BadgeColor = "green" | "red" | "amber" | "blue" | "purple" | "steel" | "gray";
export type BadgeSize = "sm" | "md";

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  green:  { bg: "var(--green-bg)",  text: "var(--green)",  border: "#86efac" },
  red:    { bg: "var(--red-bg)",    text: "var(--red)",    border: "#fca5a5" },
  amber:  { bg: "var(--amber-bg)",  text: "var(--amber)",  border: "#fde68a" },
  blue:   { bg: "var(--blue-bg)",   text: "var(--blue)",   border: "#93c5fd" },
  purple: { bg: "var(--purple-bg)", text: "var(--purple)", border: "#c4b5fd" },
  steel:  { bg: "var(--steel-light)", text: "var(--steel)", border: "#a3bfcf" },
  gray:   { bg: "var(--surface-2)", text: "var(--text-2)", border: "var(--border)" },
};

const SIZE_MAP: Record<BadgeSize, React.CSSProperties> = {
  sm: { fontSize: 11, padding: "2px 6px", borderRadius: 4 },
  md: { fontSize: 12, padding: "3px 8px", borderRadius: 5 },
};

/**
 * Map common status strings to badge colors.
 * Pass a `status` string to auto-color; or pass `color` directly for manual control.
 */
export function statusColor(status: string): BadgeColor {
  const s = status.toUpperCase();
  if (["ACTIVE", "APPROVED", "COMPLETED", "PAID", "OPERATIONAL", "PASS", "RESOLVED", "DELIVERED"].includes(s)) return "green";
  if (["TERMINATED", "REJECTED", "CANCELLED", "FAILED", "OFFLINE", "CRITICAL", "OVERDUE"].includes(s)) return "red";
  if (["PENDING", "UNDER_REVIEW", "IN_PROGRESS", "ACKNOWLEDGED", "DRAFT", "PARTIAL"].includes(s)) return "amber";
  if (["OPEN", "RUNNING", "ACTIVE_CUSTOMER", "INFO"].includes(s)) return "blue";
  if (["UNDER_MAINTENANCE", "WARNING"].includes(s)) return "amber";
  if (["VIEWER", "SUPERVISOR"].includes(s)) return "purple";
  if (["OWNER", "HR_MANAGER"].includes(s)) return "steel";
  return "gray";
}

interface BadgeProps {
  color?: BadgeColor;
  status?: string;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ color, status, size = "md", dot = false, children }: BadgeProps) {
  const resolvedColor = color ?? (status ? statusColor(status) : "gray");
  const c = COLOR_MAP[resolvedColor];
  const s = SIZE_MAP[size];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontWeight: 600,
        lineHeight: 1,
        background: c.bg,
        color: c.text,
        ...s,
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: c.text,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
