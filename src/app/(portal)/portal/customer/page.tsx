import { getCustomerDashboard } from "@/actions/portal/customer";

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color ?? "var(--steel)"}` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function CustomerDashboardPage() {
  const res = await getCustomerDashboard();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load dashboard.</div>;
  const d = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <KPI label="Open Quotations" value={d.openQuotations} color="var(--blue)" />
        <KPI label="Active Orders" value={d.activeOrders} color="var(--green)" />
        <KPI label="In Production" value={d.inProduction} color="var(--amber)" />
        <KPI label="Pending Deliveries" value={d.pendingDeliveries} color="var(--purple)" />
        <KPI
          label="Outstanding Invoices"
          value={`$${d.outstandingInvoicesUsd.toLocaleString()}`}
          color="var(--red)"
        />
      </div>

      {d.announcements.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 1rem" }}>Recent Announcements</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {d.announcements.map(a => (
              <div key={a.id} className="panel" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 14, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{a.body}</div>
                {a.publishedAt && (
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>
                    {new Date(a.publishedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
