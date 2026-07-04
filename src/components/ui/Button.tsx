"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--steel)",
    color: "#fff",
    border: "1px solid transparent",
  },
  secondary: {
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "var(--red)",
    color: "#fff",
    border: "1px solid transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-2)",
    border: "1px solid transparent",
  },
  outline: {
    background: "transparent",
    color: "var(--steel)",
    border: "1px solid var(--steel)",
  },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  xs: { padding: "3px 8px", fontSize: 11, borderRadius: 5, gap: 4 },
  sm: { padding: "5px 12px", fontSize: 12, borderRadius: 6, gap: 5 },
  md: { padding: "8px 16px", fontSize: 13, borderRadius: 7, gap: 6 },
  lg: { padding: "11px 22px", fontSize: 14, borderRadius: 8, gap: 8 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconEnd,
    fullWidth = false,
    children,
    disabled,
    style,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.65 : 1,
        transition: "opacity 0.15s, filter 0.15s",
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <Spinner size={size === "lg" ? 16 : size === "xs" ? 10 : 13} />
      ) : icon ? (
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      ) : null}
      {children}
      {iconEnd && !loading && (
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{iconEnd}</span>
      )}
    </button>
  );
});

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
