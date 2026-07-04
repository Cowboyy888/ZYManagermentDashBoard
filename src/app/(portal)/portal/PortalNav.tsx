"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

interface NavItem { href: string; label: string; icon: string; }

interface Props {
  user: { name: string; companyName: string; role: string };
  navItems: NavItem[];
  children: React.ReactNode;
}

export default function PortalNav({ user, navItems, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/portal/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: "var(--steel)", color: "#fff",
        display: "flex", flexDirection: "column", flexShrink: 0,
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        {/* Brand */}
        <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>ZY Steel</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{user.role} Portal</div>
        </div>

        {/* Company info */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>Logged in as</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{user.companyName}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0.75rem 0" }}>
          {navItems.map(item => {
            const active = pathname === item.href || (item.href !== "/portal/customer" && item.href !== "/portal/supplier" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0.6rem 1.25rem",
                  background: active ? "rgba(255,255,255,0.15)" : "transparent",
                  color: "#fff", textDecoration: "none", fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  borderLeft: active ? "3px solid rgba(255,255,255,0.8)" : "3px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "0.5rem", background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8,
              color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 500,
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto", background: "var(--bg)" }}>
        {children}
      </main>
    </div>
  );
}
