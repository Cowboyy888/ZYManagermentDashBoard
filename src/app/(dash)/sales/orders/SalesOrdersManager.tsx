"use client";
import { useState, useMemo } from "react";
import { createSalesOrder, updateSalesOrderStatus } from "@/actions/sales";

interface SOItem { id: number; inventoryItemId: number | null; description: string; unitOfMeasure: string; quantity: number; unitPriceUsd: number; totalUsd: number; deliveredQty: number; }
interface SalesOrder { id: number; orderNumber: string; customerId: number; customerName: string; customerCode: string; quotationId: number | null; status: string; orderDate: string; requestedDelivery: string | null; currency: string; totalUsd: number; paymentStatus: string; paymentTerms: string | null; notes: string | null; createdBy: string; deliveryCount: number; createdAt: string; items: SOItem[]; }
interface Customer { id: number; name: string; customerCode: string; paymentTerms: string | null; }
interface InventoryItem { id: number; itemCode: string; name: string; unitOfMeasure: string; }

const BLANK_LINE = { inventoryItemId: "", description: "", unitOfMeasure: "PCS", quantity: "1", unitPriceUsd: "0" };

const STATUS_FLOW: Record<string, string> = {
  DRAFT: "CONFIRMED", CONFIRMED: "IN_PRODUCTION", IN_PRODUCTION: "READY", READY: "DELIVERED",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#64748b", CONFIRMED: "#2563eb", IN_PRODUCTION: "#d97706",
  READY: "#16a34a", DELIVERED: "#64748b", CANCELLED: "#dc2626",
};
const PAYMENT_COLORS: Record<string, string> = {
  UNPAID: "#dc2626", PARTIAL: "#d97706", PAID: "#16a34a",
};

function Tag({ s, colors }: { s: string; colors: Record<string, string> }) {
  const c = colors[s] ?? "#64748b";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c }}>{s.replace(/_/g, " ")}</span>;
}

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function SalesOrdersManager({ orders: initial, customers, inventoryItems, canWrite, canApprove }: {
  orders: SalesOrder[]; customers: Customer[]; inventoryItems: InventoryItem[];
  canWrite: boolean; canApprove: boolean;
}) {
  const [orders, setOrders] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [draft, setDraftState] = useState({ customerId: "", orderDate: new Date().toISOString().slice(0, 10), requestedDelivery: "", paymentTerms: "", notes: "" });
  const [lines, setLines] = useState([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!q) return true;
      return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
    });
  }, [orders, search, statusFilter]);

  const grandTotal = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPriceUsd) || 0), 0), [lines]);

  const setD = (k: string, v: string) => setDraftState((d) => ({ ...d, [k]: v }));
  const updateLine = (idx: number, k: string, v: string) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, [k]: v } : l));
  const populateLine = (idx: number, itemId: string) => {
    const item = inventoryItems.find((i) => i.id === Number(itemId));
    if (!item) { updateLine(idx, "inventoryItemId", itemId); return; }
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, inventoryItemId: itemId, description: item.name, unitOfMeasure: item.unitOfMeasure } : l));
  };

  async function save() {
    setSaving(true); setError("");
    const cust = customers.find((c) => c.id === Number(draft.customerId));
    const res = await createSalesOrder({
      customerId: Number(draft.customerId),
      orderDate: draft.orderDate,
      requestedDelivery: draft.requestedDelivery || null,
      currency: "USD",
      paymentTerms: draft.paymentTerms || cust?.paymentTerms || null,
      notes: draft.notes || null,
      items: lines.map((l) => ({
        inventoryItemId: l.inventoryItemId ? Number(l.inventoryItemId) : null,
        description: l.description,
        unitOfMeasure: l.unitOfMeasure,
        quantity: parseFloat(l.quantity) || 0,
        unitPriceUsd: parseFloat(l.unitPriceUsd) || 0,
      })),
    });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const o = res.data as unknown as SalesOrder;
    setOrders((prev) => [{
      ...o, customerName: cust?.name ?? "", customerCode: cust?.customerCode ?? "",
      totalUsd: Number(o.totalUsd), orderDate: typeof o.orderDate === "string" ? o.orderDate : (o.orderDate as Date).toISOString(),
      createdBy: "", deliveryCount: 0,
      items: (o.items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unitPriceUsd: Number(i.unitPriceUsd), totalUsd: Number(i.totalUsd), deliveredQty: 0 })),
    }, ...prev]);
    setShowCreate(false);
    setDraftState({ customerId: "", orderDate: new Date().toISOString().slice(0, 10), requestedDelivery: "", paymentTerms: "", notes: "" });
    setLines([{ ...BLANK_LINE }]);
  }

  async function advance(id: number) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const nextStatus = STATUS_FLOW[order.status];
    if (!nextStatus) return;
    const res = await updateSalesOrderStatus({ id, status: nextStatus });
    if ("error" in res) { alert(res.error); return; }
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: nextStatus } : o));
  }

  async function cancel(id: number) {
    const res = await updateSalesOrderStatus({ id, status: "CANCELLED" });
    if ("error" in res) { alert(res.error); return; }
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "CANCELLED" } : o));
  }

  async function setPayment(id: number, paymentStatus: string) {
    const res = await updateSalesOrderStatus({ id, status: orders.find((o) => o.id === id)?.status ?? "CONFIRMED", paymentStatus });
    if ("error" in res) return;
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, paymentStatus } : o));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" placeholder="Search order#, customer..." style={{ flex: 1, minWidth: 200 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {["DRAFT","CONFIRMED","IN_PRODUCTION","READY","DELIVERED","CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        {canWrite && <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setError(""); }}>+ New Order</button>}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel">
          <div className="panel-head">
            <h2>New Sales Order</h2>
            <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
          <div className="panel-body">
            {error && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Customer *</label>
                <select className="input" value={draft.customerId} onChange={(e) => setD("customerId", e.target.value)}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Order Date *</label>
                <input className="input" type="date" value={draft.orderDate} onChange={(e) => setD("orderDate", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Requested Delivery</label>
                <input className="input" type="date" value={draft.requestedDelivery} onChange={(e) => setD("requestedDelivery", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Payment Terms</label>
                <input className="input" value={draft.paymentTerms} onChange={(e) => setD("paymentTerms", e.target.value)} placeholder="e.g. Net 30" />
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["Item Lookup","Description","UOM","Qty","Price","Total",""].map((h) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const t = (parseFloat(l.quantity)||0) * (parseFloat(l.unitPriceUsd)||0);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: 4 }}>
                        <select style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", minWidth: 120 }}
                          value={l.inventoryItemId} onChange={(e) => populateLine(idx, e.target.value)}>
                          <option value="">— manual —</option>
                          {inventoryItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 4 }}><input style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 160 }} value={l.description} onChange={(e) => updateLine(idx, "description", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 60 }} value={l.unitOfMeasure} onChange={(e) => updateLine(idx, "unitOfMeasure", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input type="number" min="0" style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 70 }} value={l.quantity} onChange={(e) => updateLine(idx, "quantity", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input type="number" min="0" step="0.01" style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 80 }} value={l.unitPriceUsd} onChange={(e) => updateLine(idx, "unitPriceUsd", e.target.value)} /></td>
                      <td style={{ padding: 4, fontSize: 12, fontWeight: 600, textAlign: "right", minWidth: 80 }}>{fmtUsd(t)}</td>
                      <td style={{ padding: 4 }}>{lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 16 }}>×</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <button className="btn btn-sm" onClick={() => setLines((ls) => [...ls, { ...BLANK_LINE }])}>+ Add Line</button>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>Total: {fmtUsd(grandTotal)}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Notes</label>
              <textarea className="input" rows={2} value={draft.notes} onChange={(e) => setD("notes", e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Create Order"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Order #</th><th>Customer</th><th>Order Date</th><th>Req. Delivery</th>
                <th>Status</th><th>Payment</th><th style={{ textAlign: "right" }}>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No orders found</td></tr>}
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{o.orderNumber}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{o.customerName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{o.customerCode}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{fmtDate(o.orderDate)}</td>
                  <td style={{ fontSize: 12, color: o.requestedDelivery && new Date(o.requestedDelivery) < new Date() && o.status !== "DELIVERED" ? "var(--red)" : "var(--text-3)" }}>
                    {o.requestedDelivery ? fmtDate(o.requestedDelivery) : "—"}
                  </td>
                  <td><Tag s={o.status} colors={STATUS_COLORS} /></td>
                  <td>
                    <select style={{ fontSize: 11, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: PAYMENT_COLORS[o.paymentStatus] ?? "var(--text)" }}
                      value={o.paymentStatus} onChange={(e) => setPayment(o.id, e.target.value)} disabled={!canApprove}>
                      <option value="UNPAID">UNPAID</option>
                      <option value="PARTIAL">PARTIAL</option>
                      <option value="PAID">PAID</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontSize: 13 }}>{fmtUsd(o.totalUsd)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-sm" onClick={() => setViewOrder(o)}>View</button>
                      {canApprove && STATUS_FLOW[o.status] && (
                        <button className="btn btn-sm" style={{ color: "var(--green)" }} onClick={() => advance(o.id)}>
                          → {STATUS_FLOW[o.status].replace(/_/g, " ")}
                        </button>
                      )}
                      {canApprove && !["DELIVERED","CANCELLED"].includes(o.status) && (
                        <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => cancel(o.id)}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal */}
      {viewOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setViewOrder(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{viewOrder.orderNumber}</h2>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>{viewOrder.customerName} · <Tag s={viewOrder.status} colors={STATUS_COLORS} /></div>
              </div>
              <button className="btn btn-sm" onClick={() => setViewOrder(null)}>Close</button>
            </div>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>Description</th><th>UOM</th><th>Qty</th><th>Delivered</th><th style={{ textAlign: "right" }}>Unit Price</th><th style={{ textAlign: "right" }}>Total</th></tr>
              </thead>
              <tbody>
                {viewOrder.items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontSize: 13 }}>{i.description}</td>
                    <td style={{ fontSize: 12 }}>{i.unitOfMeasure}</td>
                    <td style={{ fontSize: 13 }}>{i.quantity}</td>
                    <td style={{ fontSize: 12, color: i.deliveredQty >= i.quantity ? "var(--green)" : "var(--amber)" }}>{i.deliveredQty}</td>
                    <td style={{ textAlign: "right", fontSize: 13 }}>{fmtUsd(i.unitPriceUsd)}</td>
                    <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{fmtUsd(i.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--surface-2)" }}>
                  <td colSpan={5} style={{ textAlign: "right", fontWeight: 700, padding: "8px" }}>TOTAL</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", fontSize: 16, padding: "8px" }}>{fmtUsd(viewOrder.totalUsd)}</td>
                </tr>
              </tfoot>
            </table>
            {viewOrder.notes && <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 8 }}><strong>Notes:</strong> {viewOrder.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
