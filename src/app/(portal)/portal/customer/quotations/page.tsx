import { getCustomerQuotations } from "@/actions/portal/customer";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  SENT: "var(--blue)", APPROVED: "var(--green)", REJECTED: "var(--red)",
  EXPIRED: "var(--text-3)", CONVERTED: "var(--purple)", DRAFT: "var(--text-3)",
};

export default async function CustomerQuotationsPage() {
  const res = await getCustomerQuotations();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load quotations.</div>;
  const { items, total } = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Quotations</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Number</th><th>Status</th><th>Total</th><th>Valid Until</th><th>Your Response</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No quotations yet.</td></tr>
              )}
              {items.map(q => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 500 }}>{q.quotationNumber}</td>
                  <td>
                    <span className="tag" style={{ background: STATUS_COLOR[q.status] + "22", color: STATUS_COLOR[q.status] }}>
                      {q.status}
                    </span>
                  </td>
                  <td>${Number(q.totalUsd).toLocaleString()} {q.currency}</td>
                  <td>{new Date(q.validUntil).toLocaleDateString()}</td>
                  <td>
                    {q.portalAcceptedAt && <span className="tag" style={{ background: "var(--green-bg)", color: "var(--green)" }}>Accepted</span>}
                    {q.portalRejectedAt && <span className="tag" style={{ background: "var(--red-bg)", color: "var(--red)" }}>Rejected</span>}
                    {!q.portalAcceptedAt && !q.portalRejectedAt && q.status === "SENT" && (
                      <span style={{ color: "var(--text-3)", fontSize: 13 }}>Pending review</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/portal/customer/quotations/${q.id}`} className="btn btn-sm">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
