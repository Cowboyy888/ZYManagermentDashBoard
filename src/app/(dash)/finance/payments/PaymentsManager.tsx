"use client";

import { useState, useTransition } from "react";
import { recordPayment } from "@/actions/finance";

interface Payment {
  id: number;
  paymentNumber: string;
  type: string;
  method: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  customerName: string | null;
  billId: number | null;
  billNumber: string | null;
  supplierName: string | null;
  amountUsd: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface OpenInvoice { id: number; invoiceNumber: string; customerName: string; totalUsd: number; paidUsd: number }
interface OpenBill { id: number; billNumber: string; supplierName: string; totalUsd: number; paidUsd: number }

interface Props {
  payments: Payment[];
  openInvoices: OpenInvoice[];
  openBills: OpenBill[];
  canWrite: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer", CASH: "Cash", CHEQUE: "Cheque", CARD: "Card",
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export function PaymentsManager({ payments, openInvoices, openBills, canWrite }: Props) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [payType, setPayType] = useState<"RECEIVED" | "PAID">("RECEIVED");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = payments.filter((p) => {
    const matchType = typeFilter === "ALL" || p.type === typeFilter;
    const matchSearch = !search ||
      `${p.paymentNumber} ${p.invoiceNumber ?? ""} ${p.billNumber ?? ""} ${p.customerName ?? ""} ${p.supplierName ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalIn = payments.filter((p) => p.type === "RECEIVED").reduce((s, p) => s + p.amountUsd, 0);
  const totalOut = payments.filter((p) => p.type === "PAID").reduce((s, p) => s + p.amountUsd, 0);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordPayment({
        type: payType,
        method: fd.get("method") as string,
        invoiceId: fd.get("invoiceId") ? Number(fd.get("invoiceId")) : null,
        billId: fd.get("billId") ? Number(fd.get("billId")) : null,
        amountUsd: parseFloat(fd.get("amountUsd") as string),
        paymentDate: fd.get("paymentDate") as string,
        reference: fd.get("reference") as string || null,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setShowCreate(false); setError(""); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Total Received</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{fmtUsd(totalIn)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="kpi-label">Total Paid Out</div>
          <div className="kpi-value" style={{ color: "#ef4444" }}>{fmtUsd(totalOut)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net Cash Movement</div>
          <div className="kpi-value" style={{ color: totalIn - totalOut >= 0 ? "#10b981" : "#ef4444" }}>{fmtUsd(totalIn - totalOut)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Transactions</div>
          <div className="kpi-value">{payments.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" placeholder="Search payment#, invoice, customer..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 160 }}>
          <option value="ALL">All Payments</option>
          <option value="RECEIVED">Received (AR)</option>
          <option value="PAID">Paid Out (AP)</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} records</span>
        <div style={{ marginLeft: "auto" }}>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setError(""); }}>
              {showCreate ? "← Cancel" : "+ Record Payment"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Create form */}
      {showCreate && (
        <div className="panel">
          <div className="panel-head">Record Payment</div>
          <form className="panel-body" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={`btn ${payType === "RECEIVED" ? "btn-primary" : ""}`} onClick={() => setPayType("RECEIVED")}>
                Received (Customer)
              </button>
              <button type="button" className={`btn ${payType === "PAID" ? "btn-primary" : ""}`} onClick={() => setPayType("PAID")}>
                Paid Out (Supplier)
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {payType === "RECEIVED" ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Invoice</span>
                  <select className="input" name="invoiceId">
                    <option value="">— Unlinked —</option>
                    {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} — {i.customerName} (${(i.totalUsd - i.paidUsd).toFixed(2)} due)</option>)}
                  </select>
                </label>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Bill</span>
                  <select className="input" name="billId">
                    <option value="">— Unlinked —</option>
                    {openBills.map((b) => <option key={b.id} value={b.id}>{b.billNumber} — {b.supplierName} (${(b.totalUsd - b.paidUsd).toFixed(2)} due)</option>)}
                  </select>
                </label>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Method *</span>
                <select className="input" name="method" required>
                  {["BANK_TRANSFER", "CASH", "CHEQUE", "CARD"].map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Amount (USD) *</span>
                <input className="input" type="number" name="amountUsd" required step="0.01" min="0.01" placeholder="0.00" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Payment Date *</span>
                <input className="input" type="date" name="paymentDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Reference</span>
                <input className="input" name="reference" placeholder="Bank ref, TxID..." />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                <input className="input" name="notes" />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => { setShowCreate(false); setError(""); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Recording…" : "Record Payment"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment #</th>
                <th>Type</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Invoice / Bill</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No payment records</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: 11 }}>{p.paymentNumber}</code></td>
                  <td>
                    <span className="tag" style={{ background: p.type === "RECEIVED" ? "#10b98120" : "#ef444420", color: p.type === "RECEIVED" ? "#10b981" : "#ef4444", fontSize: 11 }}>
                      {p.type}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{METHOD_LABELS[p.method] ?? p.method}</td>
                  <td style={{ fontSize: 11, color: "var(--text-3)" }}>{p.reference ?? "—"}</td>
                  <td style={{ fontSize: 11 }}><code>{p.invoiceNumber ?? p.billNumber ?? "—"}</code></td>
                  <td style={{ fontSize: 12 }}>{p.customerName ?? p.supplierName ?? "—"}</td>
                  <td style={{ fontWeight: 700, color: p.type === "RECEIVED" ? "#10b981" : "#ef4444" }}>{fmtUsd(p.amountUsd)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(p.paymentDate)}</td>
                  <td style={{ fontSize: 12 }}>{p.createdBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
