"use client";

type Alert = {
  id: string;
  level: "critical" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  href: string;
};

type Data = {
  alerts: Alert[];
  counts: { critical: number; warning: number; info: number };
};

const LEVEL_CONFIG = {
  critical: { label: "Critical", color: "#ef4444", bg: "#ef444415", icon: "🔴" },
  warning:  { label: "Warning",  color: "#f59e0b", bg: "#f59e0b15", icon: "🟡" },
  info:     { label: "Info",     color: "#6366f1", bg: "#6366f115", icon: "🔵" },
} as const;

export function AlertsCenter({ data }: { data: Data }) {
  const critical = data.alerts.filter((a) => a.level === "critical");
  const warning  = data.alerts.filter((a) => a.level === "warning");
  const info     = data.alerts.filter((a) => a.level === "info");

  if (data.alerts.length === 0) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#10b981" }}>All Clear</div>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>No active alerts across all modules.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary badges */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["critical", "warning", "info"] as const).map((level) => {
          const cfg = LEVEL_CONFIG[level];
          const count = data.counts[level];
          return (
            <div key={level} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}40` }}>
              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: cfg.color }}>{count}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{cfg.label}</div>
              </div>
            </div>
          );
        })}
        <div style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data.alerts.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Total Alerts</div>
          </div>
        </div>
      </div>

      {/* Alert groups */}
      {[
        { level: "critical" as const, items: critical },
        { level: "warning"  as const, items: warning  },
        { level: "info"     as const, items: info      },
      ].filter((g) => g.items.length > 0).map(({ level, items }) => {
        const cfg = LEVEL_CONFIG[level];
        return (
          <div key={level} className="panel" style={{ borderLeft: `4px solid ${cfg.color}` }}>
            <div className="panel-head" style={{ color: cfg.color }}>
              {cfg.icon} {cfg.label} Alerts ({items.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {items.map((alert, idx) => (
                <a
                  key={alert.id}
                  href={alert.href}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    textDecoration: "none",
                    borderTop: idx > 0 ? "1px solid var(--border)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = cfg.bg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{alert.title}</span>
                      <span className="tag" style={{ fontSize: 10, background: cfg.bg, color: cfg.color }}>{alert.module}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{alert.detail}</div>
                  </div>
                  <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600, whiteSpace: "nowrap", paddingTop: 2 }}>
                    View →
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>
        Alerts refresh on page load. Auto-refresh is not enabled — reload to check for new alerts.
      </div>
    </div>
  );
}
