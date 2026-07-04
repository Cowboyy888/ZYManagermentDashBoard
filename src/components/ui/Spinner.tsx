import type { CSSProperties } from "react";

interface SpinnerProps {
  size?: number;
  color?: string;
  label?: string;
  style?: CSSProperties;
}

export function Spinner({ size = 20, color = "var(--steel)", label = "Loading…", style }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}
        aria-hidden
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.2" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Full-page centered loading screen */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 300,
        gap: 16,
        color: "var(--text-3)",
      }}
    >
      <Spinner size={32} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}

/** Inline skeleton placeholder for text content */
export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 4,
}: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    >
      <style>{`@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`}</style>
    </div>
  );
}
