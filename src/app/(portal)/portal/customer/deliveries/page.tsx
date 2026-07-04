import { getCustomerDeliveries } from "@/actions/portal/customer";

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "var(--blue)", IN_TRANSIT: "var(--amber)", DELIVERED: "var(--green)", FAILED: "var(--red)",
};

export default async function CustomerDeliveriesPage() {
  const res = await getCustomerDeliveries();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load deliveries.</div>;
  const { items } = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Deliveries</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Delivery #</th><th>Order</th><th>Status</th><th>Scheduled</th><th>Delivered</th><th>Carrier</th><th>Tracking #</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No deliveries yet.</td></tr>
              )}
              {items.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.deliveryNumber}</td>
                  <td><a href={`/portal/customer/orders/${d.order.id}`} style={{ color: "var(--steel)" }}>{d.order.orderNumber}</a></td>
                  <td><span className="tag" style={{ background: STATUS_COLOR[d.status] + "22", color: STATUS_COLOR[d.status] }}>{d.status.replace("_", " ")}</span></td>
                  <td>{new Date(d.scheduledDate).toLocaleDateString()}</td>
                  <td>{d.deliveredDate ? new Date(d.deliveredDate).toLocaleDateString() : "—"}</td>
                  <td>{d.carrier ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{d.trackingNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
