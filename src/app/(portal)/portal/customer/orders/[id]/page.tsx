import { getCustomerOrderDetail } from "@/actions/portal/customer";
import { notFound } from "next/navigation";
import Link from "next/link";

const DELIVERY_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "var(--blue)", IN_TRANSIT: "var(--amber)", DELIVERED: "var(--green)", FAILED: "var(--red)",
};

const INSPECTION_RESULT_COLOR: Record<string, string> = {
  PASS: "var(--green)", FAIL: "var(--red)", REWORK: "var(--amber)",
};

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getCustomerOrderDetail(Number(id));
  if (!res.ok) notFound();
  const o = res.data;

  const productionSteps = [
    { label: "Order Confirmed", done: ["CONFIRMED","IN_PRODUCTION","READY","DELIVERED"].includes(o.status) },
    { label: "In Production", done: ["IN_PRODUCTION","READY","DELIVERED"].includes(o.status) },
    { label: "Ready to Ship", done: ["READY","DELIVERED"].includes(o.status) },
    { label: "Delivered", done: o.status === "DELIVERED" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link href="/portal/customer/orders" style={{ color: "var(--text-3)", textDecoration: "none", fontSize: 14 }}>← Back</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Order {o.orderNumber}</h1>
      </div>

      {/* Production Progress */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Production Progress</div>
        <div className="panel-body">
          <div style={{ display: "flex", gap: 0 }}>
            {productionSteps.map((step, i) => (
              <div key={step.label} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {i < productionSteps.length - 1 && (
                  <div style={{
                    position: "absolute", top: 14, left: "50%", right: "-50%",
                    height: 2, background: step.done ? "var(--green)" : "var(--border)", zIndex: 0,
                  }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", margin: "0 auto 8px",
                  background: step.done ? "var(--green)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: step.done ? "#fff" : "var(--text-3)", fontWeight: 700, fontSize: 12,
                  position: "relative", zIndex: 1,
                }}>
                  {step.done ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 12, color: step.done ? "var(--text)" : "var(--text-3)", fontWeight: step.done ? 600 : 400 }}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order items */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Items</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th><th>Delivered</th></tr></thead>
            <tbody>
              {o.items.map(item => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{Number(item.quantity).toLocaleString()}</td>
                  <td>{item.unitOfMeasure}</td>
                  <td>${Number(item.unitPriceUsd).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>${Number(item.totalUsd).toLocaleString()}</td>
                  <td>{Number(item.deliveredQty).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deliveries */}
      {o.deliveries.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-head">Deliveries</div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Delivery #</th><th>Status</th><th>Scheduled</th><th>Delivered</th><th>Carrier</th><th>Tracking</th></tr></thead>
              <tbody>
                {o.deliveries.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.deliveryNumber}</td>
                    <td><span className="tag" style={{ background: DELIVERY_STATUS_COLOR[d.status] + "22", color: DELIVERY_STATUS_COLOR[d.status] }}>{d.status}</span></td>
                    <td>{new Date(d.scheduledDate).toLocaleDateString()}</td>
                    <td>{d.deliveredDate ? new Date(d.deliveredDate).toLocaleDateString() : "—"}</td>
                    <td>{d.carrier ?? "—"}</td>
                    <td>{d.trackingNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quality inspections */}
      {o.qualityInspections.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-head">Quality Inspections</div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Inspection #</th><th>Type</th><th>Status</th><th>Result</th><th>Date</th></tr></thead>
              <tbody>
                {o.qualityInspections.map(qi => (
                  <tr key={qi.id}>
                    <td>{qi.inspectionNumber}</td>
                    <td><span className="tag">{qi.type}</span></td>
                    <td><span className="tag">{qi.status}</span></td>
                    <td>{qi.result ? <span className="tag" style={{ background: INSPECTION_RESULT_COLOR[qi.result] + "22", color: INSPECTION_RESULT_COLOR[qi.result] }}>{qi.result}</span> : "—"}</td>
                    <td>{new Date(qi.inspectionDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices */}
      {o.invoices.length > 0 && (
        <div className="panel">
          <div className="panel-head">Invoices</div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Invoice #</th><th>Status</th><th>Total</th><th>Paid</th><th>Due Date</th></tr></thead>
              <tbody>
                {o.invoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500 }}><a href={`/portal/customer/invoices`} style={{ color: "var(--steel)" }}>{inv.invoiceNumber}</a></td>
                    <td><span className="tag">{inv.status}</span></td>
                    <td>${Number(inv.totalUsd).toLocaleString()}</td>
                    <td style={{ color: Number(inv.paidUsd) >= Number(inv.totalUsd) ? "var(--green)" : "inherit" }}>${Number(inv.paidUsd).toLocaleString()}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
