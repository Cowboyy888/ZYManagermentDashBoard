import { getCustomerOrders } from "@/actions/portal/customer";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "var(--text-3)", CONFIRMED: "var(--blue)", IN_PRODUCTION: "var(--amber)",
  READY: "var(--green)", DELIVERED: "var(--purple)", CANCELLED: "var(--red)",
};
const STATUS_ICON: Record<string, string> = {
  DRAFT: "📝", CONFIRMED: "✅", IN_PRODUCTION: "⚙️", READY: "📦", DELIVERED: "🚚", CANCELLED: "❌",
};

export default async function CustomerOrdersPage() {
  const res = await getCustomerOrders();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load orders.</div>;
  const { items, total } = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Sales Orders</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Order #</th><th>Status</th><th>Total</th><th>Order Date</th><th>Requested Delivery</th><th>Payment</th><th></th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No orders yet.</td></tr>
              )}
              {items.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.orderNumber}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                      <span>{STATUS_ICON[o.status]}</span>
                      <span className="tag" style={{ background: STATUS_COLOR[o.status] + "22", color: STATUS_COLOR[o.status] }}>
                        {o.status.replace("_", " ")}
                      </span>
                    </span>
                  </td>
                  <td>${Number(o.totalUsd).toLocaleString()}</td>
                  <td>{new Date(o.orderDate).toLocaleDateString()}</td>
                  <td>{o.requestedDelivery ? new Date(o.requestedDelivery).toLocaleDateString() : "—"}</td>
                  <td>
                    <span className="tag" style={{
                      background: o.paymentStatus === "PAID" ? "var(--green-bg)" : "var(--amber-bg)",
                      color: o.paymentStatus === "PAID" ? "var(--green)" : "var(--amber)",
                    }}>{o.paymentStatus}</span>
                  </td>
                  <td><Link href={`/portal/customer/orders/${o.id}`} className="btn btn-sm">Track</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
