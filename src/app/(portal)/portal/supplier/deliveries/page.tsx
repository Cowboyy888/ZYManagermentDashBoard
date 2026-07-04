import { getSupplierPurchaseOrders } from "@/actions/portal/supplier";

export default async function SupplierDeliveriesPage() {
  const res = await getSupplierPurchaseOrders();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load deliveries.</div>;
  const orders = res.data.items.filter(po =>
    po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED"
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Deliveries</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>PO #</th><th>Status</th><th>Expected Delivery</th><th>Your Confirmed Date</th><th>Receipts</th></tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No active deliveries.</td></tr>
              )}
              {orders.map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 500 }}>
                    <a href={`/portal/supplier/orders/${po.id}`} style={{ color: "var(--steel)" }}>{po.poNumber}</a>
                  </td>
                  <td><span className="tag">{po.status.replace("_", " ")}</span></td>
                  <td>{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : "—"}</td>
                  <td style={{ color: po.supplierConfirmedDelivery ? "var(--green)" : "var(--text-3)" }}>
                    {po.supplierConfirmedDelivery ? new Date(po.supplierConfirmedDelivery).toLocaleDateString() : "Not confirmed"}
                  </td>
                  <td>{po._count.receipts} receipt{po._count.receipts !== 1 ? "s" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: "1rem" }}>
        To confirm or update delivery dates, open the Purchase Order detail page.
      </p>
    </div>
  );
}
