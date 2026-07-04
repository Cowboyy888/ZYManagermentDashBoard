import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ToastProvider } from "@/components/ui/Toast";
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

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Skip-to-content for keyboard and screen-reader users */}
      <a
        href="#main-content"
        style={{
          position: "absolute", top: -40, left: 0, zIndex: 100,
          background: "var(--steel)", color: "#fff",
          padding: "8px 16px", fontSize: 14, fontWeight: 600,
          textDecoration: "none", borderRadius: "0 0 8px 0",
          transition: "top 0.1s",
        }}
        onFocus={(e) => { (e.currentTarget as HTMLElement).style.top = "0"; }}
        onBlur={(e) => { (e.currentTarget as HTMLElement).style.top = "-40px"; }}
      >
        Skip to content
      </a>
      <Sidebar userName={user.name} userRole={user.role} notifications={notifCount} />
      <div style={{ marginLeft: 230, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar with global search */}
        <header style={{
          position: "sticky", top: 0, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 24px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}>
          <GlobalSearch />
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
        </header>
        <main id="main-content" style={{ flex: 1 }}>
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
