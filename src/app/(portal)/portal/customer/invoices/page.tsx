import { getCustomerInvoices } from "@/actions/portal/customer";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "var(--text-3)", SENT: "var(--blue)", PAID: "var(--green)", OVERDUE: "var(--red)", CANCELLED: "var(--text-3)",
};

export default async function CustomerInvoicesPage() {
  const res = await getCustomerInvoices();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load invoices.</div>;
  const { items } = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Invoices</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Invoice #</th><th>Order</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Due Date</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No invoices yet.</td></tr>
              )}
              {items.map(inv => {
                const balance = Number(inv.totalUsd) - Number(inv.paidUsd);
                const overdue = balance > 0 && new Date(inv.dueDate) < new Date();
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500 }}>{inv.invoiceNumber}</td>
                    <td>{inv.salesOrder ? <a href={`/portal/customer/orders/${inv.salesOrder.id}`} style={{ color: "var(--steel)" }}>{inv.salesOrder.orderNumber}</a> : "—"}</td>
                    <td>
                      <span className="tag" style={{ background: STATUS_COLOR[inv.status] + "22", color: STATUS_COLOR[inv.status] }}>
                        {inv.status}
                      </span>
                    </td>
                    <td>${Number(inv.totalUsd).toLocaleString()}</td>
                    <td>${Number(inv.paidUsd).toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: balance > 0 ? (overdue ? "var(--red)" : "var(--amber)") : "var(--green)" }}>
                      ${balance.toLocaleString()}
                    </td>
                    <td style={{ color: overdue ? "var(--red)" : "inherit" }}>
                      {new Date(inv.dueDate).toLocaleDateString()}
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
