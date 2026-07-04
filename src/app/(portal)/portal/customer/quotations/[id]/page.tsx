import { getCustomerQuotationDetail } from "@/actions/portal/customer";
import QuotationActions from "./QuotationActions";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getCustomerQuotationDetail(Number(id));
  if (!res.ok) notFound();
  const q = res.data;

  const canAct = (q.status === "SENT" || q.status === "APPROVED") && !q.portalAcceptedAt && !q.portalRejectedAt;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link href="/portal/customer/quotations" style={{ color: "var(--text-3)", textDecoration: "none", fontSize: 14 }}>← Back</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Quotation {q.quotationNumber}</h1>
        <span className="tag" style={{ marginLeft: "auto" }}>{q.status}</span>
      </div>

      {/* Summary */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Summary</div>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Quotation #</div><div style={{ fontWeight: 600 }}>{q.quotationNumber}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Revision</div><div style={{ fontWeight: 600 }}>Rev {q.revision}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Valid Until</div><div style={{ fontWeight: 600 }}>{new Date(q.validUntil).toLocaleDateString()}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Currency</div><div style={{ fontWeight: 600 }}>{q.currency}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Subtotal</div><div style={{ fontWeight: 600 }}>${Number(q.subtotalUsd).toLocaleString()}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Tax</div><div style={{ fontWeight: 600 }}>${Number(q.taxUsd).toLocaleString()}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Discount</div><div style={{ fontWeight: 600 }}>-${Number(q.discountUsd).toLocaleString()}</div></div>
          <div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Total</div><div style={{ fontWeight: 700, fontSize: 18, color: "var(--steel)" }}>${Number(q.totalUsd).toLocaleString()}</div></div>
        </div>
      </div>

      {/* Items */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Line Items</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>#</th><th>Description</th><th>Spec</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>
              {q.items.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>{item.description}</td>
                  <td style={{ color: "var(--text-2)", fontSize: 13 }}>{item.specification ?? "—"}</td>
                  <td>{Number(item.quantity).toLocaleString()}</td>
                  <td>{item.unitOfMeasure}</td>
                  <td>${Number(item.unitPriceUsd).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>${Number(item.totalUsd).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terms */}
      {q.termsConditions && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-head">Terms & Conditions</div>
          <div className="panel-body">
            <p style={{ fontSize: 14, color: "var(--text-2)", whiteSpace: "pre-wrap", margin: 0 }}>{q.termsConditions}</p>
          </div>
        </div>
      )}

      {/* Portal response status */}
      {q.portalAcceptedAt && (
        <div style={{ background: "var(--green-bg)", color: "var(--green)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
          ✅ You accepted this quotation on {new Date(q.portalAcceptedAt).toLocaleDateString()}.
          {q.portalNote && <div style={{ marginTop: 4, fontSize: 13 }}>Note: {q.portalNote}</div>}
        </div>
      )}
      {q.portalRejectedAt && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
          ❌ You rejected this quotation on {new Date(q.portalRejectedAt).toLocaleDateString()}.
          {q.portalNote && <div style={{ marginTop: 4, fontSize: 13 }}>Reason: {q.portalNote}</div>}
        </div>
      )}

      {/* Accept / Reject actions */}
      {canAct && <QuotationActions quotationId={q.id} />}
    </div>
  );
}
