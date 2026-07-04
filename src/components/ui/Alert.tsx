import type { ReactNode } from "react";

export type AlertLevel = "info" | "success" | "warning" | "error";

const LEVEL_STYLES: Record<AlertLevel, { bg: string; text: string; border: string; icon: string }> = {
  info:    { bg: "var(--blue-bg)",   text: "var(--blue)",   border: "#93c5fd", icon: "ℹ️" },
  success: { bg: "var(--green-bg)",  text: "var(--green)",  border: "#86efac", icon: "✓" },
  warning: { bg: "var(--amber-bg)",  text: "var(--amber)",  border: "#fde68a", icon: "⚠" },
  error:   { bg: "var(--red-bg)",    text: "var(--red)",    border: "#fca5a5", icon: "✕" },
};

interface AlertProps {
  level?: AlertLevel;
  title?: string;
  children?: ReactNode;
  message?: string;
  onDismiss?: () => void;
}

export function Alert({ level = "info", title, children, message, onDismiss }: AlertProps) {
  const s = LEVEL_STYLES[level];
  const content = children ?? message;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 8,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, fontWeight: 700 }}>{s.icon}</span>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: content ? 2 : 0 }}>{title}</div>}
        {content && <div style={{ opacity: 0.9 }}>{content}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: s.text,
            flexShrink: 0,
            fontSize: 16,
            lineHeight: 1,
            opacity: 0.6,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Field-level validation error display */
export function FieldError({ errors }: { errors?: string[] | null }) {
  if (!errors || errors.length === 0) return null;
  return (
    <p style={{ fontSize: 11, color: "var(--red)", margin: "3px 0 0 0" }}>
      {errors.join(". ")}
    </p>
  );
}
