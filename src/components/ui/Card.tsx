import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  padding?: number | string;
  style?: CSSProperties;
  noBorder?: boolean;
}

export function Card({ title, subtitle, actions, children, padding = 20, style, noBorder = false }: CardProps) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: noBorder ? "none" : "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: `14px ${typeof padding === "number" ? `${padding}px` : padding}`,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            {title && (
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
            )}
            {subtitle && (
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 0 0" }}>{subtitle}</p>
            )}
          </div>
          {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: typeof padding === "number" ? `${padding}px` : padding }}>{children}</div>
    </div>
  );
}

/** A single KPI metric tile. */
export function KpiCard({
  label,
  value,
  sub,
  accent = "steel",
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "red" | "amber" | "blue" | "purple" | "steel";
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    green: "var(--green)", red: "var(--red)", amber: "var(--amber)",
    blue: "var(--blue)", purple: "var(--purple)", steel: "var(--steel)",
  };
  const bgs: Record<string, string> = {
    green: "var(--green-bg)", red: "var(--red-bg)", amber: "var(--amber-bg)",
    blue: "var(--blue-bg)", purple: "var(--purple-bg)", steel: "var(--steel-light)",
  };
  return (
    <div
      onClick={onClick}
      style={{
        background: bgs[accent],
        borderRadius: 10,
        padding: "14px 18px",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: colors[accent], lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
