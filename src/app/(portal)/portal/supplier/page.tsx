import { getSupplierDashboard } from "@/actions/portal/supplier";

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color ?? "var(--steel)"}` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function SupplierDashboardPage() {
  const res = await getSupplierDashboard();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load dashboard.</div>;
  const d = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Supplier Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <KPI label="Open Orders" value={d.openOrders} color="var(--blue)" />
        <KPI label="Awaiting Response" value={d.pendingApproval} color="var(--amber)" />
        <KPI label="Total Orders" value={d.totalOrders} />
        <KPI label="Pending Bills" value={`$${d.pendingBillsUsd.toLocaleString()}`} color="var(--red)" />
        <KPI label="Total Paid" value={`$${d.paidUsd.toLocaleString()}`} color="var(--green)" />
        {d.performanceScore !== null && (
          <KPI
            label="On-Time Rate"
            value={`${d.performanceScore}%`}
            color={d.performanceScore >= 90 ? "var(--green)" : d.performanceScore >= 70 ? "var(--amber)" : "var(--red)"}
          />
        )}
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
