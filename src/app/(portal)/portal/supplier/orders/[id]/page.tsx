import { getSupplierPODetail } from "@/actions/portal/supplier";
import POActions from "./POActions";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function SupplierPODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getSupplierPODetail(Number(id));
  if (!res.ok) notFound();
  const po = res.data;

  const canAct = po.status === "APPROVED" && !po.supplierAcceptedAt && !po.supplierRejectedAt;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link href="/portal/supplier/orders" style={{ color: "var(--text-3)", textDecoration: "none", fontSize: 14 }}>← Back</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>PO {po.poNumber}</h1>
        <span className="tag" style={{ marginLeft: "auto" }}>{po.status.replace("_", " ")}</span>
      </div>

      {/* Summary */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Order Details</div>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>PO Number</div><div style={{ fontWeight: 600 }}>{po.poNumber}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Order Date</div><div style={{ fontWeight: 600 }}>{new Date(po.orderDate).toLocaleDateString()}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Expected Delivery</div><div style={{ fontWeight: 600 }}>{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : "—"}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Currency</div><div style={{ fontWeight: 600 }}>{po.currency}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Total Amount</div><div style={{ fontWeight: 700, fontSize: 18, color: "var(--steel)" }}>${Number(po.totalAmountUsd).toLocaleString()}</div></div>
        </div>
        {po.notes && (
          <div style={{ marginTop: "1rem", padding: "0 1.25rem 1rem" }}>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>Notes from ZY Steel</div>
            <div style={{ fontSize: 14, color: "var(--text-2)" }}>{po.notes}</div>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Items</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th><th>Received</th></tr></thead>
            <tbody>
              {po.items.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>{item.description}{item.inventoryItem && <span style={{ fontSize: 12, color: "var(--text-3)" }}> [{item.inventoryItem.itemCode}]</span>}</td>
                  <td>{Number(item.quantity).toLocaleString()}</td>
                  <td>{item.unitOfMeasure}</td>
                  <td>${Number(item.unitPriceUsd).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>${Number(item.totalUsd).toLocaleString()}</td>
                  <td style={{ color: Number(item.receivedQty) >= Number(item.quantity) ? "var(--green)" : "inherit" }}>
                    {Number(item.receivedQty).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier response status */}
      {po.supplierAcceptedAt && (
        <div style={{ background: "var(--green-bg)", color: "var(--green)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
          ✅ You accepted this PO on {new Date(po.supplierAcceptedAt).toLocaleDateString()}.
          {po.supplierConfirmedDelivery && <div style={{ marginTop: 4, fontSize: 13 }}>Confirmed delivery: {new Date(po.supplierConfirmedDelivery).toLocaleDateString()}</div>}
          {po.supplierNote && <div style={{ marginTop: 4, fontSize: 13 }}>Note: {po.supplierNote}</div>}
        </div>
      )}
      {po.supplierRejectedAt && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
          ❌ You rejected this PO on {new Date(po.supplierRejectedAt).toLocaleDateString()}.
          {po.supplierNote && <div style={{ marginTop: 4, fontSize: 13 }}>Reason: {po.supplierNote}</div>}
        </div>
      )}

      {/* Actions */}
      {canAct && <POActions poId={po.id} expectedDelivery={po.expectedDelivery ? new Date(po.expectedDelivery).toISOString().split("T")[0] : ""} />}

      {/* Receipts */}
      {po.receipts.length > 0 && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="panel-head">Goods Receipts</div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Receipt #</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {po.receipts.map(r => (
                  <tr key={r.id}><td>{r.receiptNumber}</td><td>{new Date(r.receivedDate).toLocaleDateString()}</td><td><span className="tag">{r.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
