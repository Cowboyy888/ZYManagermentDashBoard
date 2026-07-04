"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { ZysteelLogo } from "@/components/ZysteelLogo";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/",             label: "Dashboard",           icon: GridIcon },
      { href: "/executive",    label: "Executive Analytics",  icon: BarLineIcon },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/employees",     label: "Employees",      icon: UsersIcon },
      { href: "/org-chart",     label: "Org Chart",      icon: OrgIcon },
      { href: "/attendance",    label: "Attendance",     icon: CalendarIcon },
      { href: "/overtime",      label: "Overtime",       icon: ClockIcon },
      { href: "/leave",         label: "Leave",          icon: LeaveIcon },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/departments", label: "Departments", icon: DeptIcon },
      { href: "/positions",   label: "Positions",   icon: PosIcon  },
    ],
  },
  {
    label: "Production",
    items: [
      { href: "/production",             label: "Overview",      icon: BarLineIcon },
      { href: "/production/orders",      label: "Orders",        icon: ClipboardIcon },
      { href: "/production/inventory",   label: "Inventory",     icon: BoxIcon },
      { href: "/production/machines",    label: "Machines",      icon: GearIcon },
      { href: "/production/maintenance", label: "Maintenance",   icon: WrenchIcon },
      { href: "/production/quality",     label: "Quality",       icon: ShieldCheckIcon },
      { href: "/production/reports",     label: "Daily Reports", icon: ChartIcon },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory",              label: "Overview",      icon: BoxIcon },
      { href: "/inventory/items",        label: "Items",         icon: ClipboardIcon },
      { href: "/inventory/warehouses",   label: "Warehouses",    icon: BuildingIcon },
      { href: "/inventory/transactions", label: "Transactions",  icon: TruckIcon },
      { href: "/inventory/reports",      label: "Reports",       icon: ChartIcon },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { href: "/purchasing",              label: "Overview",      icon: ShoppingCartIcon },
      { href: "/purchasing/suppliers",    label: "Suppliers",     icon: BuildingIcon },
      { href: "/purchasing/requisitions", label: "Requisitions",  icon: ClipboardIcon },
      { href: "/purchasing/orders",       label: "Orders",        icon: BoxIcon },
      { href: "/purchasing/receipts",     label: "Receiving",     icon: TruckIcon },
      { href: "/purchasing/reports",      label: "Reports",       icon: ChartIcon },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { href: "/sales",              label: "Overview",      icon: TagIcon },
      { href: "/sales/customers",    label: "Customers",     icon: UsersIcon },
      { href: "/sales/leads",        label: "Leads",         icon: FunnelIcon },
      { href: "/sales/quotations",   label: "Quotations",    icon: ClipboardIcon },
      { href: "/sales/orders",       label: "Orders",        icon: BoxIcon },
      { href: "/sales/deliveries",   label: "Deliveries",    icon: TruckIcon },
      { href: "/sales/reports",      label: "Reports",       icon: ChartIcon },
    ],
  },
  {
    label: "Quality & QMS",
    items: [
      { href: "/quality",              label: "Overview",     icon: ShieldCheckIcon },
      { href: "/quality/inspections",  label: "Inspections",  icon: ClipboardIcon },
      { href: "/quality/ncr",          label: "NCR",          icon: AlertIcon },
      { href: "/quality/capa",         label: "CAPA",         icon: CheckSquareIcon },
      { href: "/quality/certificates", label: "Certificates", icon: BadgeIcon },
      { href: "/quality/reports",      label: "Reports",      icon: ChartIcon },
    ],
  },
  {
    label: "Maintenance (CMMS)",
    items: [
      { href: "/maintenance",             label: "Overview",      icon: WrenchIcon },
      { href: "/maintenance/assets",      label: "Assets",        icon: GearIcon },
      { href: "/maintenance/work-orders", label: "Work Orders",   icon: ClipboardIcon },
      { href: "/maintenance/schedules",   label: "PM Schedules",  icon: CalendarIcon },
      { href: "/maintenance/spare-parts", label: "Spare Parts",   icon: BoxIcon },
      { href: "/maintenance/reports",     label: "Reports",       icon: ChartIcon },
    ],
  },
  {
    label: "Finance & Accounting",
    items: [
      { href: "/finance",           label: "Overview",   icon: FinanceIcon },
      { href: "/finance/invoices",  label: "Invoices",   icon: ClipboardIcon },
      { href: "/finance/bills",     label: "Bills",      icon: TruckIcon },
      { href: "/finance/payments",  label: "Payments",   icon: CashIcon },
      { href: "/finance/expenses",  label: "Expenses",   icon: TagIcon },
      { href: "/finance/reports",   label: "Reports",    icon: ChartIcon },
    ],
  },
  {
    label: "BI & Analytics",
    items: [
      { href: "/bi",              label: "CEO Dashboard",  icon: BarLineIcon },
      { href: "/bi/hr",           label: "HR Analytics",   icon: UsersIcon },
      { href: "/bi/production",   label: "Production",     icon: GearIcon },
      { href: "/bi/sales",        label: "Sales",          icon: ShoppingCartIcon },
      { href: "/bi/finance",      label: "Finance",        icon: FinanceIcon },
      { href: "/bi/quality",      label: "Quality",        icon: ShieldCheckIcon },
      { href: "/bi/maintenance",  label: "Maintenance",    icon: WrenchIcon },
      { href: "/bi/inventory",    label: "Inventory",      icon: BoxIcon },
      { href: "/bi/purchasing",   label: "Purchasing",     icon: TruckIcon },
      { href: "/bi/forecast",     label: "Forecast",       icon: ChartIcon },
      { href: "/bi/alerts",       label: "Alerts",         icon: AlertIcon },
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
  {
    label: "Portal",
    items: [
      { href: "/portal",                    label: "Overview",     icon: GlobeIcon },
      { href: "/portal/customers",          label: "Customers",    icon: UsersIcon },
      { href: "/portal/suppliers",          label: "Suppliers",    icon: BuildingIcon },
      { href: "/portal/tickets",            label: "Tickets",      icon: ClipboardIcon },
      { href: "/portal/announcements",      label: "Announcements", icon: BellIcon },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/users",   label: "Users",       icon: KeyIcon },
      { href: "/admin/audit",   label: "Audit Log",   icon: ClipboardIcon },
      { href: "/admin/health",  label: "System Health", icon: HeartPulseIcon },
    ],
  },
  {
    label: "AI & Automation",
    items: [
      { href: "/ai/hr",         label: "HR Assistant",        icon: SparkleIcon },
      { href: "/ai/production", label: "Production AI",       icon: SparkleIcon },
      { href: "/ai/sales",      label: "Sales AI",            icon: SparkleIcon },
    ],
  },
  {
    label: "Alerts",
    items: [
      { href: "/notifications", label: "Notifications", icon: BellIcon },
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
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-2 space-y-0">
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
              const showBadge = href === "/notifications" && notifications > 0;
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
                  <span className="flex-1">{label}</span>
                  {showBadge && (
                    <span
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: 9999,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        minWidth: 18,
                        textAlign: "center",
                        lineHeight: "16px",
                      }}
                    >
                      {notifications > 99 ? "99+" : notifications}
                    </span>
                  )}
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
function LeaveIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>
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
function ClipboardIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  );
}
function BoxIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>
    </svg>
  );
}
function GearIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function WrenchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}
function ShieldCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
function ChartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18"/>
      <path d="M7 16l4-4 4 4 4-8"/>
    </svg>
  );
}
function KeyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6M15 8l3 3"/>
    </svg>
  );
}
function SparkleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}
function DeptIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <path d="M12 12v4M8 12v4M16 12v4"/>
    </svg>
  );
}
function PosIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M20 21a8 8 0 1 0-16 0"/>
      <path d="M15 12l2 2 4-4"/>
    </svg>
  );
}
function TruckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function BarLineIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18"/>
      <rect x="7" y="10" width="3" height="8" rx="1"/>
      <rect x="13" y="6" width="3" height="12" rx="1"/>
      <path d="M5 7l4-2 4 4 6-5"/>
    </svg>
  );
}
function ShoppingCartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}
function TagIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function FunnelIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );
}
function AlertIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function CheckSquareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  );
}
function BadgeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  );
}
function FinanceIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function HeartPulseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      <path d="M3.22 12H9.5l1.5-3 2 4.5 1.5-6 1.5 4.5h5.27"/>
    </svg>
  );
}
function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}
