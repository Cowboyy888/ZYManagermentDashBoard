"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { ZysteelLogo } from "@/components/ZysteelLogo";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/",              label: "Dashboard",      icon: GridIcon },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/employees",     label: "Employees",      icon: UsersIcon },
      { href: "/org-chart",     label: "Org Chart",      icon: OrgIcon },
      { href: "/attendance",    label: "Attendance",     icon: CalendarIcon },
      { href: "/overtime",      label: "Overtime",       icon: ClockIcon },
    ],
  },
  {
    label: "Factory",
    items: [
      { href: "/factory-areas", label: "Factory Areas",  icon: BuildingIcon },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/payroll",       label: "Payroll",        icon: CashIcon },
    ],
  },
];

export function Sidebar({
  userName,
  userRole,
  notifications = 0,
}: {
  userName: string;
  userRole: string;
  notifications?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{ width: 230, background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col h-screen"
    >
      {/* Brand */}
      <div
        style={{ borderBottom: "1px solid var(--border)" }}
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
      >
        <ZysteelLogo size={34} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em", color: "var(--text)" }}>
            ZYSTEEL
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>中粤铁网 · HR</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-3)",
                padding: "10px 10px 3px",
                fontWeight: 600,
              }}
            >
              {section.label}
            </div>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: "var(--radius)",
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: active ? "#fff" : "var(--text-2)",
                    background: active ? "var(--steel)" : "transparent",
                    transition: "all 0.12s",
                    textDecoration: "none",
                    marginBottom: 1,
                  }}
                  className={!active ? "hover-nav-item" : ""}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: 10 }} className="flex-shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--purple-bg)",
              color: "var(--purple)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }} className="truncate">
              {userName}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-3)" }}>{userRole}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 12.5,
            color: "var(--text-3)",
            textAlign: "left",
            marginTop: 2,
          }}
          className="hover-sign-out"
        >
          Sign out
        </button>
      </div>

      <style jsx>{`
        .hover-nav-item:hover {
          background: var(--surface-2) !important;
          color: var(--text) !important;
        }
        .hover-sign-out:hover {
          background: var(--red-bg) !important;
          color: var(--red) !important;
        }
      `}</style>
    </aside>
  );
}

// ── Icons (inline SVG for zero dependencies) ──────────────────────────────────
function GridIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}
function ClockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  );
}
function CashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  );
}
function BuildingIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 21h18M3 7v14M21 7v14M6 21V3h12v18M9 7h1M14 7h1M9 12h1M14 12h1M9 17h1M14 17h1"/>
    </svg>
  );
}
function OrgIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="8" y="2" width="8" height="5" rx="1"/>
      <rect x="1" y="16" width="6" height="5" rx="1"/>
      <rect x="9" y="16" width="6" height="5" rx="1"/>
      <rect x="17" y="16" width="6" height="5" rx="1"/>
      <path d="M4 16v-3h16v3M12 7v6"/>
    </svg>
  );
}
