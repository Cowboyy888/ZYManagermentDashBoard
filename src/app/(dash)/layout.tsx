import { requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { prisma } from "@/lib/db";

async function getNotificationCount(): Promise<number> {
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);

  const [expiring, birthdays] = await Promise.all([
    prisma.employee.count({
      where: {
        status: "ACTIVE",
        contractExpiry: { not: null, lte: in30, gte: today },
      },
    }).catch(() => 0),
    prisma.employee.count({
      where: {
        status: "ACTIVE",
        birthday: {
          not: null,
          // same month+day window — Prisma doesn't support this natively, approximate
        },
      },
    }).catch(() => 0),
  ]);

  return expiring;
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifCount = await getNotificationCount();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
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
          {notifCount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 12px", borderRadius: 8,
              background: "var(--amber-bg)", color: "var(--amber)",
              fontSize: 12, fontWeight: 600,
            }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {notifCount} contract{notifCount > 1 ? "s" : ""} expiring soon
            </div>
          )}
        </header>
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
