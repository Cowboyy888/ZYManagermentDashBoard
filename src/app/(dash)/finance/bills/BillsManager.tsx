"use client";

import { useState, useTransition } from "react";
import { createBill, voidBill, recordPayment } from "@/actions/finance";

interface Bill {
  id: number;
  billNumber: string;
  supplierId: number;
  supplierName: string;
  supplierCode: string;
  purchaseOrderId: number | null;
  poNumber: string | null;
  billDate: string;
  dueDate: string;
  status: string;
  subtotalUsd: number;
  taxUsd: number;
  totalUsd: number;
  paidUsd: number;
  notes: string | null;
  paymentCount: number;
  createdAt: string;
}

interface Supplier { id: number; name: string; supplierCode: string; paymentTerms: string | null }
interface PurchaseOrder { id: number; poNumber: string; supplierId: number; totalAmountUsd: number }

interface Props {
  bills: Bill[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  canWrite: boolean;
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#6366f1", PARTIAL: "#f59e0b", PAID: "#10b981", OVERDUE: "#ef4444", VOID: "#94a3b8",
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export function BillsManager({ bills, suppliers, purchaseOrders, canWrite, canManage }: Props) {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [payBillId, setPayBillId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  const filtered = bills.filter((b) => {
    const matchSearch = !search || `${b.billNumber} ${b.supplierName} ${b.supplierCode}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const viewBill = viewId !== null ? bills.find((b) => b.id === viewId) : null;
  const payBill = payBillId !== null ? bills.find((b) => b.id === payBillId) : null;
  const filteredPOs = selectedSupplierId ? purchaseOrders.filter((p) => p.supplierId === selectedSupplierId) : purchaseOrders;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createBill({
        supplierId: Number(fd.get("supplierId")),
        purchaseOrderId: fd.get("purchaseOrderId") ? Number(fd.get("purchaseOrderId")) : null,
        billDate: fd.get("billDate") as string,
        dueDate: fd.get("dueDate") as string,
        subtotalUsd: parseFloat(fd.get("subtotalUsd") as string) || 0,
        taxUsd: parseFloat(fd.get("taxUsd") as string) || 0,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setTab("list"); setError(""); }
    });
  }

  function handleVoid(id: number) {
    if (!confirm("Void this bill? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await voidBill(id);
      if ("error" in res) setError(res.error);
    });
  }

  function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payBill) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordPayment({
        type: "PAID",
        method: fd.get("method") as string,
        billId: payBill.id,
        amountUsd: parseFloat(fd.get("amount") as string),
        paymentDate: fd.get("paymentDate") as string,
        reference: fd.get("reference") as string || null,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setPayBillId(null); setError(""); }
    });
  }

  const totalPayable = filtered.filter((b) => !["VOID", "PAID"].includes(b.status)).reduce((s, b) => s + b.totalUsd - b.paidUsd, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {["PENDING", "PARTIAL", "OVERDUE", "PAID"].map((s) => {
          const count = bills.filter((b) => b.status === s).length;
          const total = bills.filter((b) => b.status === s).reduce((sum, b) => sum + b.totalUsd, 0);
          return (
            <div key={s} className="kpi-card" style={{ cursor: "pointer", borderTop: `3px solid ${STATUS_COLORS[s] ?? "#94a3b8"}` }} onClick={() => setStatusFilter(s === statusFilter ? "ALL" : s)}>
              <div className="kpi-label">{s}</div>
              <div className="kpi-value" style={{ color: STATUS_COLORS[s], fontSize: 18 }}>{count}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {tab === "list" && (
          <>
            <input className="input" placeholder="Search bill#, supplier..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140 }}>
              <option value="ALL">All Statuses</option>
              {["PENDING", "PARTIAL", "PAID", "OVERDUE", "VOID"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} bills · Payable: ${totalPayable.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </>
        )}
        <div style={{ marginLeft: "auto" }}>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => { setTab(tab === "list" ? "create" : "list"); setError(""); }}>
              {tab === "list" ? "+ New Bill" : "← Back to List"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Create Form */}
      {tab === "create" && (
        <div className="panel">
          <div className="panel-head">New Supplier Bill</div>
          <form className="panel-body" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Supplier *</span>
                <select className="input" name="supplierId" required onChange={(e) => setSelectedSupplierId(Number(e.target.value))}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplierCode} — {s.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Linked Purchase Order</span>
                <select className="input" name="purchaseOrderId">
                  <option value="">— None —</option>
                  {filteredPOs.map((p) => <option key={p.id} value={p.id}>{p.poNumber} (${p.totalAmountUsd.toFixed(0)})</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Bill Date *</span>
                <input className="input" type="date" name="billDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Due Date *</span>
                <input className="input" type="date" name="dueDate" required defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Subtotal (USD) *</span>
                <input className="input" type="number" name="subtotalUsd" required step="0.01" min="0" placeholder="0.00" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Tax (USD)</span>
                <input className="input" type="number" name="taxUsd" step="0.01" min="0" defaultValue="0" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                <textarea className="input" name="notes" rows={2} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => { setTab("list"); setError(""); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Creating…" : "Create Bill"}</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {tab === "list" && (
        <div className="panel">
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Supplier</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No bills found</td></tr>
                ) : filtered.map((b) => {
                  const outstanding = b.totalUsd - b.paidUsd;
                  const isOverdue = new Date(b.dueDate) < new Date() && !["PAID", "VOID"].includes(b.status);
                  return (
                    <tr key={b.id} style={{ background: isOverdue ? "var(--red-bg)" : undefined }}>
                      <td><code style={{ fontSize: 11 }}>{b.billNumber}</code></td>
                      <td style={{ fontSize: 12, fontWeight: 500 }}>{b.supplierName}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(b.billDate)}</td>
                      <td style={{ fontSize: 12, color: isOverdue ? "var(--red)" : undefined, fontWeight: isOverdue ? 600 : undefined }}>
                        {fmtDate(b.dueDate)} {isOverdue && "⚠"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmtUsd(b.totalUsd)}</td>
                      <td style={{ fontSize: 12, color: "#10b981" }}>{fmtUsd(b.paidUsd)}</td>
                      <td style={{ fontWeight: 600, color: outstanding > 0 ? "#f97316" : "#10b981" }}>{fmtUsd(outstanding)}</td>
                      <td>
                        <span className="tag" style={{ background: (STATUS_COLORS[b.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[b.status] ?? "#94a3b8", fontSize: 11 }}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-sm" onClick={() => setViewId(b.id)}>View</button>
                          {canWrite && !["PAID", "VOID"].includes(b.status) && (
                            <button className="btn btn-sm" style={{ fontSize: 10, background: "#10b98120", color: "#10b981" }} onClick={() => setPayBillId(b.id)}>
                              Pay
                            </button>
                          )}
                          {canManage && b.status !== "VOID" && (
                            <button className="btn btn-sm" style={{ fontSize: 10, color: "#ef4444" }} onClick={() => handleVoid(b.id)} disabled={isPending}>
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewBill && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 480 }}>
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{viewBill.billNumber}</span>
              <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
            </div>
            <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Supplier", viewBill.supplierName],
                ["PO Linked", viewBill.poNumber ?? "—"],
                ["Bill Date", fmtDate(viewBill.billDate)],
                ["Due Date", fmtDate(viewBill.dueDate)],
                ["Subtotal", fmtUsd(viewBill.subtotalUsd)],
                ["Tax", fmtUsd(viewBill.taxUsd)],
                ["Total", fmtUsd(viewBill.totalUsd)],
                ["Paid", fmtUsd(viewBill.paidUsd)],
                ["Outstanding", fmtUsd(viewBill.totalUsd - viewBill.paidUsd)],
                ["Payments", viewBill.paymentCount],
                ["Status", viewBill.status],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13 }}>{val}</div>
                </div>
              ))}
              {viewBill.notes && (
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>Notes</div>
                  <div style={{ fontSize: 13 }}>{viewBill.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payBill && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 400 }}>
            <div className="panel-head">Pay Bill — {payBill.billNumber}</div>
            <form className="panel-body" onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--bg-2)", fontSize: 13 }}>
                Outstanding: <strong>{fmtUsd(payBill.totalUsd - payBill.paidUsd)}</strong>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Amount (USD) *</span>
                <input className="input" type="number" name="amount" required step="0.01" min="0.01" defaultValue={(payBill.totalUsd - payBill.paidUsd).toFixed(2)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Method *</span>
                <select className="input" name="method" required>
                  {["BANK_TRANSFER", "CASH", "CHEQUE", "CARD"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Date *</span>
                <input className="input" type="date" name="paymentDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Reference</span>
                <input className="input" name="reference" />
              </label>
              {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setPayBillId(null); setError(""); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Paying…" : "Record Payment"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
