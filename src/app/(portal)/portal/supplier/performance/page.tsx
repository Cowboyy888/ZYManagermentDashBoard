import { getSupplierPerformance } from "@/actions/portal/supplier";

function Metric({ label, value, color, sub }: { label: string; value: string | number | null; color?: string; sub?: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color ?? "var(--steel)"}` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color }}>{value ?? "N/A"}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function SupplierPerformancePage() {
  const res = await getSupplierPerformance();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load performance data.</div>;
  const d = res.data;

  const onTimeColor = d.onTimeRate === null ? "var(--text-3)"
    : d.onTimeRate >= 90 ? "var(--green)"
    : d.onTimeRate >= 70 ? "var(--amber)"
    : "var(--red)";

  const fulfilColor = d.fulfilmentRate === null ? "var(--text-3)"
    : d.fulfilmentRate >= 95 ? "var(--green)"
    : d.fulfilmentRate >= 80 ? "var(--amber)"
    : "var(--red)";

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Supplier Performance</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <Metric label="Total Orders" value={d.totalOrders} />
        <Metric label="Cancelled Orders" value={d.cancelledOrders} color="var(--red)" />
        <Metric
          label="Fulfilment Rate"
          value={d.fulfilmentRate !== null ? `${d.fulfilmentRate}%` : null}
          color={fulfilColor}
          sub={`${d.totalOrders - d.cancelledOrders} of ${d.totalOrders} completed`}
        />
        <Metric label="Total Deliveries" value={d.totalDeliveries} />
        <Metric label="On-Time Deliveries" value={d.onTimeDeliveries} color="var(--green)" />
        <Metric
          label="On-Time Rate"
          value={d.onTimeRate !== null ? `${d.onTimeRate}%` : null}
          color={onTimeColor}
          sub={`${d.onTimeDeliveries} of ${d.totalDeliveries} on time`}
        />
        <Metric label="Total Billed" value={`$${d.totalBilledUsd.toLocaleString()}`} />
        <Metric label="Total Paid" value={`$${d.totalPaidUsd.toLocaleString()}`} color="var(--green)" />
        <Metric
          label="Outstanding"
          value={`$${d.outstandingUsd.toLocaleString()}`}
          color={d.outstandingUsd > 0 ? "var(--amber)" : "var(--green)"}
        />
      </div>

      <div className="panel">
        <div className="panel-head">Performance Summary</div>
        <div className="panel-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: onTimeColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {d.onTimeRate !== null ? (d.onTimeRate >= 90 ? "A" : d.onTimeRate >= 70 ? "B" : "C") : "?"}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>On-Time Delivery</div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                  {d.onTimeRate !== null
                    ? `${d.onTimeRate}% of deliveries arrived on or before the expected date.`
                    : "No delivery data yet."}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: fulfilColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {d.fulfilmentRate !== null ? (d.fulfilmentRate >= 95 ? "A" : d.fulfilmentRate >= 80 ? "B" : "C") : "?"}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Order Fulfilment</div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                  {d.fulfilmentRate !== null
                    ? `${d.fulfilmentRate}% of orders fulfilled without cancellation.`
                    : "No order data yet."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
