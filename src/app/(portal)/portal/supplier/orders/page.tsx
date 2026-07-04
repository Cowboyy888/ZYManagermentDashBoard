import { getSupplierPurchaseOrders } from "@/actions/portal/supplier";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "var(--text-3)", PENDING_APPROVAL: "var(--amber)", APPROVED: "var(--blue)",
  PARTIALLY_RECEIVED: "var(--purple)", RECEIVED: "var(--green)", CANCELLED: "var(--red)",
};

export default async function SupplierOrdersPage() {
  const res = await getSupplierPurchaseOrders();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load purchase orders.</div>;
  const { items } = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Purchase Orders</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>PO #</th><th>Status</th><th>Total</th><th>Order Date</th><th>Expected Delivery</th><th>Your Response</th><th></th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No purchase orders.</td></tr>
              )}
              {items.map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 500 }}>{po.poNumber}</td>
                  <td><span className="tag" style={{ background: STATUS_COLOR[po.status] + "22", color: STATUS_COLOR[po.status] }}>{po.status.replace("_", " ")}</span></td>
                  <td>${Number(po.totalAmountUsd).toLocaleString()} {po.currency}</td>
                  <td>{new Date(po.orderDate).toLocaleDateString()}</td>
                  <td>{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : "—"}</td>
                  <td>
                    {po.supplierAcceptedAt && <span className="tag" style={{ background: "var(--green-bg)", color: "var(--green)" }}>Accepted {po.supplierConfirmedDelivery ? `· ETA ${new Date(po.supplierConfirmedDelivery).toLocaleDateString()}` : ""}</span>}
                    {po.supplierRejectedAt && <span className="tag" style={{ background: "var(--red-bg)", color: "var(--red)" }}>Rejected</span>}
                    {!po.supplierAcceptedAt && !po.supplierRejectedAt && po.status === "APPROVED" && (
                      <span style={{ color: "var(--amber)", fontSize: 13, fontWeight: 500 }}>⚠ Awaiting response</span>
                    )}
                  </td>
                  <td><Link href={`/portal/supplier/orders/${po.id}`} className="btn btn-sm">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
