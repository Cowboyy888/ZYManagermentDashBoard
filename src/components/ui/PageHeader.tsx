import type { ReactNode } from "react";
import Link from "next/link";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
        gap: 16,
      }}
    >
      <div>
        {/* Breadcrumbs */}
        {(breadcrumbs || backHref) && (
          <nav
            aria-label="breadcrumb"
            style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}
          >
            {backHref && (
              <Link
                href={backHref}
                style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}
              >
                ← {backLabel ?? "Back"}
              </Link>
            )}
            {breadcrumbs?.map((b, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>/</span>}
                {b.href ? (
                  <Link
                    href={b.href}
                    style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}
                  >
                    {b.label}
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 0 0" }}>{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
