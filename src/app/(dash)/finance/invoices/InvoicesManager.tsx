"use client";

import { useState, useTransition } from "react";
import { createInvoice, updateInvoiceStatus, voidInvoice, recordPayment } from "@/actions/finance";

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unitPriceUsd: number;
  totalUsd: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotalUsd: number;
  taxUsd: number;
  discountUsd: number;
  totalUsd: number;
  paidUsd: number;
  notes: string | null;
  paymentCount: number;
  items: InvoiceItem[];
  createdAt: string;
}

interface Customer { id: number; name: string; customerCode: string }
interface SalesOrder { id: number; orderNumber: string; customerId: number; totalUsd: number }

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  canWrite: boolean;
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", SENT: "#6366f1", PARTIAL: "#f59e0b",
  PAID: "#10b981", OVERDUE: "#ef4444", VOID: "#94a3b8",
};

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["PARTIAL", "PAID"],
  PARTIAL: ["PAID"],
  PAID: [],
  OVERDUE: ["PARTIAL", "PAID"],
  VOID: [],
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

interface LineItem { description: string; quantity: string; unitPriceUsd: string }

export function InvoicesManager({ invoices, customers, salesOrders, canWrite, canManage }: Props) {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [payInvoiceId, setPayInvoiceId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: "1", unitPriceUsd: "0" }]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const filtered = invoices.filter((i) => {
    const matchSearch = !search || `${i.invoiceNumber} ${i.customerName} ${i.customerCode}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const viewInvoice = viewId !== null ? invoices.find((i) => i.id === viewId) : null;
  const payInvoice = payInvoiceId !== null ? invoices.find((i) => i.id === payInvoiceId) : null;

  const filteredSOs = selectedCustomerId
    ? salesOrders.filter((s) => s.customerId === selectedCustomerId)
    : salesOrders;

  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPriceUsd) || 0), 0);

  function addLine() { setLineItems((l) => [...l, { description: "", quantity: "1", unitPriceUsd: "0" }]); }
  function removeLine(i: number) { setLineItems((l) => l.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: keyof LineItem, val: string) {
    setLineItems((l) => l.map((li, idx) => idx === i ? { ...li, [field]: val } : li));
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createInvoice({
        customerId: Number(fd.get("customerId")),
        salesOrderId: fd.get("salesOrderId") ? Number(fd.get("salesOrderId")) : null,
        invoiceDate: fd.get("invoiceDate") as string,
        dueDate: fd.get("dueDate") as string,
        taxUsd: parseFloat(fd.get("taxUsd") as string) || 0,
        discountUsd: parseFloat(fd.get("discountUsd") as string) || 0,
        notes: fd.get("notes") as string || null,
        items: lineItems.map((i) => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 0,
          unitPriceUsd: parseFloat(i.unitPriceUsd) || 0,
        })),
      });
      if ("error" in res) { setError(res.error); } else { setTab("list"); setError(""); setLineItems([{ description: "", quantity: "1", unitPriceUsd: "0" }]); }
    });
  }

  function handleStatusChange(inv: Invoice, status: string) {
    startTransition(async () => {
      const res = await updateInvoiceStatus({ id: inv.id, status });
      if ("error" in res) setError(res.error);
    });
  }

  function handleVoid(id: number) {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await voidInvoice(id);
      if ("error" in res) setError(res.error);
    });
  }

  function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payInvoice) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordPayment({
        type: "RECEIVED",
        method: fd.get("method") as string,
        invoiceId: payInvoice.id,
        amountUsd: parseFloat(fd.get("amount") as string),
        paymentDate: fd.get("paymentDate") as string,
        reference: fd.get("reference") as string || null,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setPayInvoiceId(null); setError(""); }
    });
  }

  const totalReceivable = filtered.filter((i) => !["VOID", "PAID"].includes(i.status)).reduce((s, i) => s + i.totalUsd - i.paidUsd, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {["DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"].map((s) => {
          const count = invoices.filter((i) => i.status === s).length;
          const total = invoices.filter((i) => i.status === s).reduce((sum, i) => sum + i.totalUsd, 0);
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
            <input className="input" placeholder="Search invoice#, customer..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140 }}>
              <option value="ALL">All Statuses</option>
              {["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "VOID"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} invoices · Outstanding: ${totalReceivable.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </>
        )}
        <div style={{ marginLeft: "auto" }}>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => { setTab(tab === "list" ? "create" : "list"); setError(""); }}>
              {tab === "list" ? "+ New Invoice" : "← Back to List"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Create Form */}
      {tab === "create" && (
        <div className="panel">
          <div className="panel-head">New Customer Invoice</div>
          <form className="panel-body" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Customer *</span>
                <select className="input" name="customerId" required onChange={(e) => setSelectedCustomerId(Number(e.target.value))}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.customerCode} — {c.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Linked Sales Order</span>
                <select className="input" name="salesOrderId">
                  <option value="">— None —</option>
                  {filteredSOs.map((s) => <option key={s.id} value={s.id}>{s.orderNumber} (${s.totalUsd.toFixed(0)})</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Invoice Date *</span>
                <input className="input" type="date" name="invoiceDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Due Date *</span>
                <input className="input" type="date" name="dueDate" required defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)} />
              </label>
            </div>

            {/* Line items */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Line Items</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--text-3)" }}>Description</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-3)", width: 80 }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-3)", width: 120 }}>Unit Price</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-3)", width: 100 }}>Total</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => {
                    const lineTotal = (parseFloat(li.quantity) || 0) * (parseFloat(li.unitPriceUsd) || 0);
                    return (
                      <tr key={i}>
                        <td style={{ padding: "3px 4px" }}><input className="input" style={{ fontSize: 12 }} value={li.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="Description" required /></td>
                        <td style={{ padding: "3px 4px" }}><input className="input" style={{ fontSize: 12, textAlign: "right" }} type="number" step="0.001" min="0.001" value={li.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} /></td>
                        <td style={{ padding: "3px 4px" }}><input className="input" style={{ fontSize: 12, textAlign: "right" }} type="number" step="0.01" min="0" value={li.unitPriceUsd} onChange={(e) => updateLine(i, "unitPriceUsd", e.target.value)} /></td>
                        <td style={{ padding: "3px 8px", textAlign: "right", fontWeight: 600 }}>${lineTotal.toFixed(2)}</td>
                        <td><button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }} onClick={() => removeLine(i)}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addLine}>+ Add Line</button>
            </div>

            {/* Totals */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Tax (USD)</span>
                <input className="input" type="number" name="taxUsd" step="0.01" min="0" defaultValue="0" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Discount (USD)</span>
                <input className="input" type="number" name="discountUsd" step="0.01" min="0" defaultValue="0" />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Subtotal</span>
                <div style={{ padding: "8px 12px", background: "var(--bg-2)", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>${subtotal.toFixed(2)}</div>
              </div>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
              <textarea className="input" name="notes" rows={2} />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => { setTab("list"); setError(""); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Creating…" : "Create Invoice"}</button>
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
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Invoice Date</th>
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
                  <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No invoices found</td></tr>
                ) : filtered.map((inv) => {
                  const outstanding = inv.totalUsd - inv.paidUsd;
                  const isOverdue = new Date(inv.dueDate) < new Date() && !["PAID", "VOID"].includes(inv.status);
                  const transitions = STATUS_FLOW[inv.status] ?? [];
                  return (
                    <tr key={inv.id} style={{ background: isOverdue ? "var(--red-bg)" : undefined }}>
                      <td><code style={{ fontSize: 11 }}>{inv.invoiceNumber}</code></td>
                      <td style={{ fontSize: 12, fontWeight: 500 }}>{inv.customerName}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(inv.invoiceDate)}</td>
                      <td style={{ fontSize: 12, color: isOverdue ? "var(--red)" : undefined, fontWeight: isOverdue ? 600 : undefined }}>
                        {fmtDate(inv.dueDate)} {isOverdue && "⚠"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmtUsd(inv.totalUsd)}</td>
                      <td style={{ fontSize: 12, color: "#10b981" }}>{fmtUsd(inv.paidUsd)}</td>
                      <td style={{ fontWeight: 600, color: outstanding > 0 ? "#f97316" : "#10b981" }}>{fmtUsd(outstanding)}</td>
                      <td>
                        <span className="tag" style={{ background: (STATUS_COLORS[inv.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[inv.status] ?? "#94a3b8", fontSize: 11 }}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-sm" onClick={() => setViewId(inv.id)}>View</button>
                          {canWrite && transitions.map((next) => (
                            <button key={next} className="btn btn-sm btn-primary" style={{ fontSize: 10 }} onClick={() => handleStatusChange(inv, next)} disabled={isPending}>
                              → {next}
                            </button>
                          ))}
                          {canWrite && !["PAID", "VOID"].includes(inv.status) && (
                            <button className="btn btn-sm" style={{ fontSize: 10, background: "#10b98120", color: "#10b981" }} onClick={() => setPayInvoiceId(inv.id)}>
                              Pay
                            </button>
                          )}
                          {canManage && !["VOID"].includes(inv.status) && (
                            <button className="btn btn-sm" style={{ fontSize: 10, color: "#ef4444" }} onClick={() => handleVoid(inv.id)} disabled={isPending}>
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
      {viewInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 580, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{viewInvoice.invoiceNumber}</span>
              <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
            </div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["Customer", viewInvoice.customerName],
                  ["Sales Order", viewInvoice.salesOrderNumber ?? "—"],
                  ["Invoice Date", fmtDate(viewInvoice.invoiceDate)],
                  ["Due Date", fmtDate(viewInvoice.dueDate)],
                  ["Status", viewInvoice.status],
                  ["Payments", viewInvoice.paymentCount],
                ].map(([label, val]) => (
                  <div key={String(label)}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13 }}>{val}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Line Items</div>
                <table className="data-table">
                  <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {viewInvoice.items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.description}</td>
                        <td style={{ textAlign: "right" }}>{it.quantity}</td>
                        <td style={{ textAlign: "right" }}>{fmtUsd(it.unitPriceUsd)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtUsd(it.totalUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["Subtotal", fmtUsd(viewInvoice.subtotalUsd)],
                  ["Tax", fmtUsd(viewInvoice.taxUsd)],
                  ["Discount", fmtUsd(viewInvoice.discountUsd)],
                  ["Total", fmtUsd(viewInvoice.totalUsd)],
                  ["Paid", fmtUsd(viewInvoice.paidUsd)],
                  ["Outstanding", fmtUsd(viewInvoice.totalUsd - viewInvoice.paidUsd)],
                ].map(([label, val]) => (
                  <div key={String(label)}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>

              {viewInvoice.notes && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13 }}>{viewInvoice.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 420 }}>
            <div className="panel-head">Record Payment — {payInvoice.invoiceNumber}</div>
            <form className="panel-body" onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--bg-2)", fontSize: 13 }}>
                Outstanding: <strong>{fmtUsd(payInvoice.totalUsd - payInvoice.paidUsd)}</strong>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Amount (USD) *</span>
                <input className="input" type="number" name="amount" required step="0.01" min="0.01" defaultValue={(payInvoice.totalUsd - payInvoice.paidUsd).toFixed(2)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Payment Method *</span>
                <select className="input" name="method" required>
                  {["BANK_TRANSFER", "CASH", "CHEQUE", "CARD"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Payment Date *</span>
                <input className="input" type="date" name="paymentDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Reference / TxID</span>
                <input className="input" name="reference" placeholder="Bank ref, cheque number..." />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                <input className="input" name="notes" />
              </label>
              {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setPayInvoiceId(null); setError(""); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Recording…" : "Record Payment"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
