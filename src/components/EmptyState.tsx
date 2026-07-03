import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div style={{
      borderRadius: 12,
      border: "1.5px dashed var(--border)",
      padding: "48px 24px",
      textAlign: "center",
      background: "var(--surface)",
    }}>
      {icon && (
        <div style={{ fontSize: 32, marginBottom: 12, color: "var(--text-3)" }}>{icon}</div>
      )}
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)", marginBottom: description ? 6 : 0 }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: action ? 20 : 0 }}>{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
