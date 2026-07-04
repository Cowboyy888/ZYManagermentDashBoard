import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getPortalOverview } from "@/actions/portal/admin";
import Link from "next/link";

function KPI({ label, value, href, color, badge }: { label: string; value: number; href: string; color?: string; badge?: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="kpi-card" style={{ borderTop: `3px solid ${color ?? "var(--steel)"}`, cursor: "pointer" }}>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {badge && <div style={{ fontSize: 11, color: color, marginTop: 2 }}>{badge}</div>}
      </div>
    </Link>
  );
}

export default async function PortalAdminPage() {
  const user = await requireUser();
  if (!can(user.role, "portal.manage")) redirect("/");

  const res = await getPortalOverview();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load portal overview.</div>;
  const d = res.data;

  return (
    <div>
      <div className="panel-head" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Portal Management</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/portal/login" target="_blank" className="btn btn-sm">Preview Portal ↗</Link>
          <Link href="/portal/admin/announcements" className="btn btn-sm">Announcements</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Customer portal */}
        <div className="panel">
          <div className="panel-head">Customer Portal</div>
          <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <KPI label="Total" value={d.customers.total} href="/portal/admin/customers" />
            <KPI label="Pending" value={d.customers.pending} href="/portal/admin/customers?status=PENDING" color="var(--amber)" badge={d.customers.pending > 0 ? "Needs approval" : undefined} />
            <KPI label="Active" value={d.customers.active} href="/portal/admin/customers?status=ACTIVE" color="var(--green)" />
          </div>
        </div>

        {/* Supplier portal */}
        <div className="panel">
          <div className="panel-head">Supplier Portal</div>
          <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <KPI label="Total" value={d.suppliers.total} href="/portal/admin/suppliers" />
            <KPI label="Pending" value={d.suppliers.pending} href="/portal/admin/suppliers?status=PENDING" color="var(--amber)" />
            <KPI label="Active" value={d.suppliers.active} href="/portal/admin/suppliers?status=ACTIVE" color="var(--green)" />
          </div>
        </div>
      </div>

      {/* Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <KPI label="Open Tickets" value={d.openTickets} href="/portal/admin/tickets" color={d.openTickets > 0 ? "var(--red)" : "var(--green)"} />
        <KPI label="Open Messages" value={d.openThreads} href="/portal/admin/threads" color="var(--blue)" />
        <KPI label="Awaiting Quotation Response" value={d.pendingQuotationResponses} href="/sales/quotations" color="var(--amber)" />
        <KPI label="Awaiting PO Response" value={d.pendingPOResponses} href="/purchasing/orders" color="var(--amber)" />
      </div>
    </div>
  );
}
