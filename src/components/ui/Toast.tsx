"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastLevel = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  level: ToastLevel;
  title: string;
  message?: string;
  duration?: number; // ms; 0 = persistent
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toasts: Toast[];
  toast: (payload: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((payload: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${++counterRef.current}`;
    const duration = payload.duration ?? (payload.level === "error" ? 6000 : 4000);
    setToasts(prev => [...prev.slice(-4), { ...payload, id, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const success = useCallback((title: string, message?: string) => toast({ level: "success", title, message }), [toast]);
  const error   = useCallback((title: string, message?: string) => toast({ level: "error",   title, message }), [toast]);
  const warning = useCallback((title: string, message?: string) => toast({ level: "warning", title, message }), [toast]);
  const info    = useCallback((title: string, message?: string) => toast({ level: "info",    title, message }), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Toast item ──────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<ToastLevel, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", icon: "✓", iconColor: "#16a34a" },
  error:   { bg: "#fef2f2", border: "#fca5a5", icon: "✕", iconColor: "#dc2626" },
  warning: { bg: "#fffbeb", border: "#fde68a", icon: "⚠", iconColor: "#d97706" },
  info:    { bg: "#eff6ff", border: "#93c5fd", icon: "ℹ", iconColor: "#2563eb" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const s = LEVEL_STYLES[toast.level];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay for enter animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        background: s.bg,
        border: `1px solid ${s.border}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        minWidth: 280,
        maxWidth: 380,
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.25s ease, opacity 0.25s ease",
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 700, color: s.iconColor, flexShrink: 0, lineHeight: 1.3 }}>
        {s.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1c1a", lineHeight: 1.3 }}>{toast.title}</div>
        {toast.message && (
          <div style={{ fontSize: 12, color: "#6b6b66", marginTop: 2 }}>{toast.message}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9a9a94",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Container ───────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
