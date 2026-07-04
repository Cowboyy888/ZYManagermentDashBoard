import { getSupplierBills } from "@/actions/portal/supplier";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--amber)", APPROVED: "var(--blue)", PAID: "var(--green)", OVERDUE: "var(--red)", CANCELLED: "var(--text-3)",
};

export default async function SupplierPaymentsPage() {
  const res = await getSupplierBills();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load payments.</div>;
  const { items } = res.data;

  const totalPending = items.filter(b => b.status !== "PAID" && b.status !== "CANCELLED").reduce((s, b) => s + Number(b.totalUsd) - Number(b.paidUsd), 0);
  const totalPaid = items.reduce((s, b) => s + Number(b.paidUsd), 0);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Payment Status</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="kpi-card" style={{ borderTop: "3px solid var(--amber)" }}>
          <div className="kpi-label">Outstanding Balance</div>
          <div className="kpi-value">${totalPending.toLocaleString()}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid var(--green)" }}>
          <div className="kpi-label">Total Received</div>
          <div className="kpi-value">${totalPaid.toLocaleString()}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Bill #</th><th>PO #</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Due Date</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No bills yet.</td></tr>
              )}
              {items.map(bill => {
                const balance = Number(bill.totalUsd) - Number(bill.paidUsd);
                const overdue = balance > 0 && new Date(bill.dueDate) < new Date();
                return (
                  <tr key={bill.id}>
                    <td style={{ fontWeight: 500 }}>{bill.billNumber}</td>
                    <td>{bill.purchaseOrder ? <a href={`/portal/supplier/orders/${bill.purchaseOrder.id}`} style={{ color: "var(--steel)" }}>{bill.purchaseOrder.poNumber}</a> : "—"}</td>
                    <td><span className="tag" style={{ background: STATUS_COLOR[bill.status] + "22", color: STATUS_COLOR[bill.status] }}>{bill.status}</span></td>
                    <td>${Number(bill.totalUsd).toLocaleString()}</td>
                    <td>${Number(bill.paidUsd).toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: balance > 0 ? (overdue ? "var(--red)" : "var(--amber)") : "var(--green)" }}>
                      ${balance.toLocaleString()}
                    </td>
                    <td style={{ color: overdue ? "var(--red)" : "inherit" }}>
                      {new Date(bill.dueDate).toLocaleDateString()}
                      {overdue && <span style={{ fontSize: 11, marginLeft: 4, color: "var(--red)" }}>OVERDUE</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
