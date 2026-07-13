"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { ZysteelLogo } from "@/components/ZysteelLogo";
import { useTranslations } from "@/lib/i18n/useTranslations";
import * as enNav from "@/locales/en/nav";
import * as zhNav from "@/locales/zh-CN/nav";
import * as kmNav from "@/locales/km/nav";
import { can, type Role, type Action } from "@/lib/rbac";

const EXPANDED_W = 240;
const COLLAPSED_W = 56;
const LS_KEY = "zy_sidebar_collapsed";

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
  const t = useTranslations(enNav.nav, zhNav.nav, kmNav.nav);

  const role = (userRole || "") as Role;
  const canSee = (action: Action | null) => action == null || can(role, action);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bp, setBp] = useState<"desktop" | "tablet" | "mobile">("desktop");

  useEffect(() => {
    if (localStorage.getItem(LS_KEY) === "true") setCollapsed(true);

    function measure() {
      const w = window.innerWidth;
      setBp(w >= 1024 ? "desktop" : w >= 768 ? "tablet" : "mobile");
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keep layout margin in sync via CSS variable
  useEffect(() => {
    let w: number;
    if (bp === "mobile") w = 0;
    else if (bp === "tablet") w = COLLAPSED_W;
    else w = collapsed ? COLLAPSED_W : EXPANDED_W;
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
  }, [collapsed, bp]);

  // Close overlay on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggle() {
    if (bp === "desktop") {
      const next = !collapsed;
      setCollapsed(next);
      localStorage.setItem(LS_KEY, String(next));
    } else {
      setMobileOpen((o) => !o);
    }
  }

  const NAV_SECTIONS = [
    { labelKey: "sectionOverview" as const, permission: null as Action | null, items: [
      { href: "/",          labelKey: "dashboard" as const,          icon: GridIcon },
      { href: "/executive", labelKey: "executiveAnalytics" as const,  icon: BarLineIcon },
    ]},
    { labelKey: "sectionPeople" as const, permission: "employee.read" as Action, items: [
      { href: "/employees",       labelKey: "employees" as const,        icon: UsersIcon },
      { href: "/org-chart",       labelKey: "orgChart" as const,         icon: OrgIcon },
      { href: "/attendance",      labelKey: "attendance" as const,       icon: CalendarIcon },
      { href: "/attendance/daily",labelKey: "dailyAttendance" as const,  icon: CalendarIcon },
      { href: "/shifts",          labelKey: "shiftManagement" as const,  icon: ClockIcon },
      { href: "/overtime",        labelKey: "overtime" as const,         icon: ClockIcon },
      { href: "/leave",           labelKey: "leave" as const,            icon: LeaveIcon },
    ]},
    { labelKey: "sectionOrganisation" as const, permission: "settings.read" as Action, items: [
      { href: "/departments", labelKey: "departments" as const, icon: DeptIcon },
      { href: "/positions",   labelKey: "positions" as const,   icon: PosIcon  },
    ]},
    { labelKey: "sectionProduction" as const, permission: "production.read" as Action, items: [
      { href: "/production",             labelKey: "overview" as const,          icon: BarLineIcon },
      { href: "/production/planning",    labelKey: "productionPlanning" as const, icon: CalendarIcon },
      { href: "/production/shopfloor",   labelKey: "shopFloor" as const,         icon: GearIcon },
      { href: "/production/orders",      labelKey: "productionOrders" as const,  icon: ClipboardIcon },
      { href: "/production/inventory",   labelKey: "inventory" as const,         icon: BoxIcon },
      { href: "/production/machines",    labelKey: "machines" as const,          icon: GearIcon },
      { href: "/production/maintenance", labelKey: "maintenance" as const,       icon: WrenchIcon },
      { href: "/production/quality",     labelKey: "quality" as const,           icon: ShieldCheckIcon },
      { href: "/production/reports",     labelKey: "dailyReports" as const,      icon: ChartIcon },
    ]},
    { labelKey: "sectionInventory" as const, permission: "inventory.read" as Action, items: [
      { href: "/inventory",              labelKey: "overview" as const,         icon: BoxIcon },
      { href: "/inventory/items",        labelKey: "items" as const,            icon: ClipboardIcon },
      { href: "/inventory/warehouses",   labelKey: "warehouses" as const,       icon: BuildingIcon },
      { href: "/inventory/transactions", labelKey: "transactions" as const,     icon: TruckIcon },
      { href: "/inventory/reports",      labelKey: "financialReports" as const, icon: ChartIcon },
    ]},
    { labelKey: "sectionPurchasing" as const, permission: "purchasing.read" as Action, items: [
      { href: "/purchasing",              labelKey: "overview" as const,         icon: ShoppingCartIcon },
      { href: "/purchasing/suppliers",    labelKey: "suppliers" as const,        icon: BuildingIcon },
      { href: "/purchasing/requisitions", labelKey: "requisitions" as const,     icon: ClipboardIcon },
      { href: "/purchasing/orders",       labelKey: "purchaseOrders" as const,   icon: BoxIcon },
      { href: "/purchasing/receipts",     labelKey: "receiving" as const,        icon: TruckIcon },
      { href: "/purchasing/reports",      labelKey: "financialReports" as const, icon: ChartIcon },
    ]},
    { labelKey: "sectionSales" as const, permission: "sales.read" as Action, items: [
      { href: "/sales",            labelKey: "overview" as const,         icon: TagIcon },
      { href: "/sales/customers",  labelKey: "customers" as const,        icon: UsersIcon },
      { href: "/sales/leads",      labelKey: "leads" as const,            icon: FunnelIcon },
      { href: "/sales/quotations", labelKey: "quotations" as const,       icon: ClipboardIcon },
      { href: "/sales/orders",     labelKey: "salesOrders" as const,      icon: BoxIcon },
      { href: "/sales/deliveries", labelKey: "deliveries" as const,       icon: TruckIcon },
      { href: "/sales/reports",    labelKey: "financialReports" as const, icon: ChartIcon },
    ]},
    { labelKey: "sectionQuality" as const, permission: "quality.read" as Action, items: [
      { href: "/quality",              labelKey: "overview" as const,         icon: ShieldCheckIcon },
      { href: "/quality/inspections",  labelKey: "inspections" as const,      icon: ClipboardIcon },
      { href: "/quality/ncr",          labelKey: "ncr" as const,              icon: AlertIcon },
      { href: "/quality/capa",         labelKey: "capa" as const,             icon: CheckSquareIcon },
      { href: "/quality/certificates", labelKey: "certificates" as const,     icon: BadgeIcon },
      { href: "/quality/reports",      labelKey: "financialReports" as const, icon: ChartIcon },
    ]},
    { labelKey: "sectionMaintenance" as const, permission: "maintenance.read" as Action, items: [
      { href: "/maintenance",             labelKey: "overview" as const,         icon: WrenchIcon },
      { href: "/maintenance/assets",      labelKey: "assets" as const,           icon: GearIcon },
      { href: "/maintenance/work-orders", labelKey: "workOrders" as const,       icon: ClipboardIcon },
      { href: "/maintenance/schedules",   labelKey: "pmSchedules" as const,      icon: CalendarIcon },
      { href: "/maintenance/spare-parts", labelKey: "spareParts" as const,       icon: BoxIcon },
      { href: "/maintenance/reports",     labelKey: "financialReports" as const, icon: ChartIcon },
    ]},
    { labelKey: "sectionFinance" as const, permission: "finance.approve" as Action, items: [
      { href: "/finance",          labelKey: "overview" as const,         icon: FinanceIcon },
      { href: "/finance/invoices", labelKey: "invoices" as const,         icon: ClipboardIcon },
      { href: "/finance/bills",    labelKey: "bills" as const,            icon: TruckIcon },
      { href: "/finance/payments", labelKey: "payments" as const,         icon: CashIcon },
      { href: "/finance/expenses", labelKey: "expenses" as const,         icon: TagIcon },
      { href: "/finance/reports",  labelKey: "financialReports" as const, icon: ChartIcon },
    ]},
    { labelKey: "sectionBI" as const, permission: "bi.read" as Action, items: [
      { href: "/bi",             labelKey: "ceoDashboard" as const,         icon: BarLineIcon },
      { href: "/bi/hr",          labelKey: "hrAnalytics" as const,          icon: UsersIcon },
      { href: "/bi/production",  labelKey: "productionAnalytics" as const,  icon: GearIcon },
      { href: "/bi/sales",       labelKey: "salesAnalytics" as const,       icon: ShoppingCartIcon },
      { href: "/bi/finance",     labelKey: "financeAnalytics" as const,     icon: FinanceIcon },
      { href: "/bi/quality",     labelKey: "qualityAnalytics" as const,     icon: ShieldCheckIcon },
      { href: "/bi/maintenance", labelKey: "maintenanceAnalytics" as const, icon: WrenchIcon },
      { href: "/bi/inventory",   labelKey: "inventoryAnalytics" as const,   icon: BoxIcon },
      { href: "/bi/purchasing",  labelKey: "purchasingAnalytics" as const,  icon: TruckIcon },
      { href: "/bi/forecast",    labelKey: "forecast" as const,             icon: ChartIcon },
      { href: "/bi/alerts",      labelKey: "alerts" as const,               icon: AlertIcon },
    ]},
    { labelKey: "sectionSmartFactory" as const, permission: "factory.view" as Action, items: [
      { href: "/factory",          labelKey: "overview" as const,     icon: ChartIcon },
      { href: "/factory/machines", labelKey: "machines" as const,     icon: GearIcon },
      { href: "/factory/alarms",   labelKey: "alarms" as const,       icon: AlertIcon },
      { href: "/factory/oee",      labelKey: "oee" as const,          icon: ChartIcon },
      { href: "/factory/shifts",   labelKey: "shifts" as const,       icon: ClockIcon },
      { href: "/factory/iot",      labelKey: "iotDevices" as const,   icon: GlobeIcon },
      { href: "/factory-areas",    labelKey: "factoryAreas" as const, icon: BuildingIcon },
    ]},
    { labelKey: "sectionPayroll" as const, permission: "payroll.run" as Action, items: [
      { href: "/payroll", labelKey: "payroll" as const, icon: CashIcon },
    ]},
    { labelKey: "sectionPortal" as const, permission: "portal.manage" as Action, items: [
      { href: "/portal",               labelKey: "overview" as const,      icon: GlobeIcon },
      { href: "/portal/customers",     labelKey: "customers" as const,     icon: UsersIcon },
      { href: "/portal/suppliers",     labelKey: "suppliers" as const,     icon: BuildingIcon },
      { href: "/portal/tickets",       labelKey: "ai" as const,            icon: ClipboardIcon },
      { href: "/portal/announcements", labelKey: "notifications" as const, icon: BellIcon },
    ]},
    { labelKey: "sectionAdmin" as const, permission: "audit.view" as Action, items: [
      { href: "/admin/users",  labelKey: "users" as const,        icon: KeyIcon,        permission: null as Action | null },
      { href: "/admin/audit",  labelKey: "auditLog" as const,     icon: ClipboardIcon,  permission: null as Action | null },
      { href: "/admin/health", labelKey: "systemHealth" as const, icon: HeartPulseIcon, permission: "system.health" as Action | null },
      { href: "/admin/import", labelKey: "dataImport" as const,   icon: ClipboardIcon,  permission: null as Action | null },
    ]},
    { labelKey: "sectionAI" as const, permission: "employee.read" as Action, items: [
      { href: "/ai/hr",         labelKey: "hrAssistant" as const,  icon: SparkleIcon },
      { href: "/ai/production", labelKey: "productionAI" as const, icon: SparkleIcon },
      { href: "/ai/sales",      labelKey: "salesAI" as const,      icon: SparkleIcon },
    ]},
    { labelKey: "sectionAlerts" as const, permission: "notification.read" as Action, items: [
      { href: "/notifications", labelKey: "notifications" as const, icon: BellIcon },
    ]},
  ]
    .filter((s) => canSee(s.permission))
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => canSee((i as { permission?: Action | null }).permission ?? null)),
    }));

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

  // In icon-only mode when desktop, or when tablet/mobile and overlay is closed
  const iconOnly = bp === "desktop" ? collapsed : !mobileOpen;
  const showOverlay = bp !== "desktop" && mobileOpen;
  const sidebarW = iconOnly && bp !== "mobile" ? COLLAPSED_W : EXPANDED_W;
  const sidebarVisible = bp !== "mobile" || mobileOpen;

  return (
    <>
      {/* Mobile hamburger — fixed top-left when sidebar is hidden */}
      {bp === "mobile" && !mobileOpen && (
        <button
          onClick={toggle}
          aria-label="Open menu"
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 50,
            width: 36, height: 36, borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-2)",
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}

      {/* Backdrop for tablet/mobile overlay */}
      {showOverlay && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden
          style={{
            position: "fixed", inset: 0, zIndex: 29,
            background: "rgba(0,0,0,0.45)",
          }}
        />
      )}

      {/* Sidebar panel */}
      {sidebarVisible && (
        <aside style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
          width: sidebarW,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          height: "100vh",
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}>

          {/* Brand row + toggle button */}
          <div style={{
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: iconOnly ? "center" : "space-between",
            padding: iconOnly ? "14px 0" : "14px 16px",
            flexShrink: 0,
            gap: 8,
          }}>
            {iconOnly ? (
              <ZysteelLogo size={28} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ZysteelLogo size={34} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em", color: "var(--text)" }}>
                    ZYSTEEL
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>中粤铁网 · HR</div>
                </div>
              </div>
            )}
            <button
              onClick={toggle}
              title={iconOnly ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                width: 26, height: 26, borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-3)", flexShrink: 0,
              }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                {iconOnly
                  ? <path d="M9 18l6-6-6-6"/>
                  : <path d="M15 18l-6-6 6-6"/>
                }
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav
            aria-label="Main navigation"
            style={{
              flex: 1, overflowY: "auto", overflowX: "hidden",
              padding: iconOnly ? "4px 4px" : "4px 8px",
            }}
          >
            {NAV_SECTIONS.map((section) => (
              <div key={section.labelKey}>
                {!iconOnly && (
                  <div style={{
                    fontSize: 10, textTransform: "uppercase",
                    letterSpacing: "0.07em", color: "var(--text-3)",
                    padding: "10px 8px 3px", fontWeight: 700,
                  }}>
                    {t[section.labelKey]}
                  </div>
                )}
                {iconOnly && <div style={{ height: 4 }} />}
                {section.items.map(({ href, labelKey, icon: Icon }) => {
                  const active = isActive(href);
                  const showBadge = href === "/notifications" && notifications > 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={iconOnly ? t[labelKey] : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: iconOnly ? "center" : "flex-start",
                        gap: 10,
                        padding: iconOnly ? "8px 0" : "7px 8px",
                        borderRadius: "var(--radius)",
                        fontSize: 13.5, fontWeight: 500,
                        color: active ? "#fff" : "var(--text-2)",
                        background: active ? "var(--steel)" : "transparent",
                        transition: "all 0.12s",
                        textDecoration: "none",
                        marginBottom: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                      className={!active ? "zy-nav-item" : ""}
                    >
                      <Icon size={17} />
                      {!iconOnly && (
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t[labelKey]}
                        </span>
                      )}
                      {!iconOnly && showBadge && (
                        <span style={{
                          background: "#ef4444", color: "#fff",
                          borderRadius: 9999, fontSize: 10, fontWeight: 700,
                          padding: "1px 6px", minWidth: 18,
                          textAlign: "center", lineHeight: "16px",
                        }}>
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
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: iconOnly ? "8px 4px" : "8px 10px",
            flexShrink: 0,
          }}>
            {!iconOnly ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 6px" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--purple-bg)", color: "var(--purple)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600, fontSize: 12, flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      margin: 0,
                    }}>
                      {userName}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{userRole}</p>
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="zy-signout"
                  style={{
                    width: "100%", padding: "6px 8px",
                    borderRadius: "var(--radius)",
                    border: "none", background: "transparent",
                    cursor: "pointer", fontSize: 12.5,
                    color: "var(--text-3)", textAlign: "left", marginTop: 2,
                  }}
                >
                  {t.signOut}
                </button>
              </>
            ) : (
              <button
                onClick={signOut}
                title={t.signOut}
                className="zy-signout"
                style={{
                  width: "100%", padding: "8px 0",
                  borderRadius: "var(--radius)",
                  border: "none", background: "transparent",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-3)",
                }}
              >
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
              </button>
            )}
          </div>

          <style>{`
            .zy-nav-item:hover { background: var(--surface-2) !important; color: var(--text) !important; }
            .zy-signout:hover { background: var(--red-bg) !important; color: var(--red) !important; }
          `}</style>
        </aside>
      )}
    </>
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
