import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ToastProvider } from "@/components/ui/Toast";
import { SkipLink } from "@/components/SkipLink";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { detectLocale, LOCALE_COOKIE } from "@/lib/i18n/index";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function getNotificationCount(userId: string): Promise<number> {
  return prisma.notification
    .count({ where: { userId, read: false } })
    .catch(() => 0);
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifCount = await getNotificationCount(user.id);
  const cookieStore = await cookies();
  const initialLocale = detectLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <LocaleProvider initialLocale={initialLocale}>
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <SkipLink />
      <Sidebar userName={user.name} userRole={user.role} notifications={notifCount} />
      <div style={{ marginLeft: "var(--sidebar-w, 240px)", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", transition: "margin-left 0.2s ease" }}>
        {/* Top bar with global search */}
        <header style={{
          position: "sticky", top: 0, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 24px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}>
          <GlobalSearch />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <LanguageSwitcher />
          <a
            href="/notifications"
            aria-label={`${notifCount} unread notification${notifCount !== 1 ? "s" : ""}`}
            style={{
              position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--text-2)", textDecoration: "none",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                background: "#ef4444", color: "#fff",
                fontSize: 10, fontWeight: 700, lineHeight: 1,
                padding: "2px 5px", borderRadius: 10,
                minWidth: 16, textAlign: "center",
              }}>
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </a>
          </div>
        </header>
        <main id="main-content" style={{ flex: 1 }}>
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
    </LocaleProvider>
  );
}
