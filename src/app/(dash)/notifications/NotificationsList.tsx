"use client";
import { useState, useTransition } from "react";
import { markRead, markAllRead, deleteNotification, clearAllRead } from "@/actions/notifications";

type Notification = {
  id: number;
  title: string;
  body: string | null;
  level: string;
  module: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const LEVEL_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  critical: { color: "#ef4444", bg: "#ef444412", dot: "#ef4444" },
  warning:  { color: "#f59e0b", bg: "#f59e0b12", dot: "#f59e0b" },
  info:     { color: "#6366f1", bg: "#6366f112", dot: "#6366f1" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isPending, startTransition] = useTransition();

  const displayed = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  function handleMarkRead(id: number) {
    startTransition(async () => {
      await markRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    });
  }

  function handleClearRead() {
    startTransition(async () => {
      await clearAllRead();
      setItems((prev) => prev.filter((n) => !n.read));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? "btn btn-primary btn-sm" : "btn btn-sm"}
              style={{ textTransform: "capitalize" }}
            >
              {f}{f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button className="btn btn-sm" onClick={handleMarkAll} disabled={isPending}>
              Mark all read
            </button>
          )}
          <button className="btn btn-sm" onClick={handleClearRead} disabled={isPending}>
            Clear read
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
              Workflow events, alerts, and reminders will appear here.
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          {displayed.map((n, idx) => {
            const style = LEVEL_STYLES[n.level] ?? LEVEL_STYLES.info;
            const isLast = idx === displayed.length - 1;
            return (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: isLast ? "none" : "1px solid var(--border)",
                  background: n.read ? "transparent" : style.bg,
                  transition: "background 0.2s",
                }}
              >
                {/* Level dot */}
                <div style={{ marginTop: 5, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "var(--border)" : style.dot }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "var(--text)" }}>
                      {n.title}
                    </span>
                    {n.module && (
                      <span className="tag" style={{ fontSize: 10, textTransform: "uppercase" }}>{n.module}</span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{n.body}</div>
                  )}
                  {n.href && (
                    <a
                      href={n.href}
                      style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none", marginTop: 4, display: "inline-block" }}
                    >
                      View details →
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!n.read && (
                    <button
                      className="btn btn-sm"
                      title="Mark as read"
                      style={{ padding: "2px 8px", fontSize: 11 }}
                      onClick={() => handleMarkRead(n.id)}
                      disabled={isPending}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    title="Delete"
                    style={{ padding: "2px 8px", fontSize: 11, color: "var(--red)" }}
                    onClick={() => handleDelete(n.id)}
                    disabled={isPending}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
