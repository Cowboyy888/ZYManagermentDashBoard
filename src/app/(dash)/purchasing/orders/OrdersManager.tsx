"use client";
import { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { createPurchaseOrder, submitPurchaseOrder, approvePurchaseOrder, cancelPurchaseOrder } from "@/actions/purchasing";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type POItem = { id: number; description: string; unitOfMeasure: string; quantity: number; unitPriceUsd: number; totalUsd: number; receivedQty: number; inventoryItemId: number | null; notes: string | null };
type PO = { id: number; poNumber: string; supplierId: number; supplierName: string; supplierCode: string; warehouseCode: string | null; status: string; orderDate: string; expectedDelivery: string | null; totalAmountUsd: number; currency: string; notes: string | null; createdBy: string; approvedBy: string | null; receiptCount: number; items: POItem[]; createdAt: string };
type Supplier = { id: number; name: string; supplierCode: string; currency: string };
type Warehouse = { id: number; code: string; name: string };
type ApprovedPR = { id: number; prNumber: string };
type InvItem = { id: number; itemCode: string; name: string; unitOfMeasure: string; unitCostUsd: number | null };

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:              { bg: "var(--border)",    color: "var(--text-3)", label: "Draft" },
  PENDING_APPROVAL:   { bg: "var(--amber-bg)", color: "var(--amber)",  label: "Pending Approval" },
  APPROVED:           { bg: "var(--blue-bg)",  color: "var(--blue)",   label: "Approved" },
  PARTIALLY_RECEIVED: { bg: "var(--purple-bg)", color: "var(--purple)", label: "Partial" },
  RECEIVED:           { bg: "var(--green-bg)", color: "var(--green)",  label: "Received" },
  CANCELLED:          { bg: "var(--red-bg)",   color: "var(--red)",    label: "Cancelled" },
};

const blankLine = { inventoryItemId: "", description: "", unitOfMeasure: "pcs", quantity: "", unitPriceUsd: "" };
const blankForm = { supplierId: "", prId: "", warehouseId: "", orderDate: "", expectedDelivery: "", currency: "USD", notes: "", items: [{ ...blankLine }] };

function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export function OrdersManager({ orders: initial, suppliers, warehouses, approvedPRs, inventoryItems, canManage, canApprove }: {
  orders: PO[]; suppliers: Supplier[]; warehouses: Warehouse[];
  approvedPRs: ApprovedPR[]; inventoryItems: InvItem[];
  canManage: boolean; canApprove: boolean;
}) {
  const [orders, setOrders]  = useState(initial);
  const [filter, setFilter]  = useState("");
  const [search, setSearch]  = useState("");
  const [viewPO, setView]    = useState<PO | null>(null);
  const [showForm, setShow]  = useState(false);
  const [form, setForm]      = useState(blankForm);
  const [err, setErr]        = useState("");
  const [pending, startT]    = useTransition();

  const filtered = useMemo(() => orders.filter((o) => {
    if (filter && o.status !== filter) return false;
    if (search && !`${o.poNumber} ${o.supplierName} ${o.supplierCode}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [orders, filter, search]);

  const exportData = useMemo(() => filtered.map((o) => ({
    "PO Number": o.poNumber, "Supplier": o.supplierName, "Order Date": fmtDate(o.orderDate),
    "Expected Delivery": o.expectedDelivery ? fmtDate(o.expectedDelivery) : "",
    "Total (USD)": o.totalAmountUsd.toFixed(2), "Status": o.status,
    "Created By": o.createdBy, "Approved By": o.approvedBy ?? "",
  })), [filtered]);

  function addLine() { setForm((p) => ({ ...p, items: [...p.items, { ...blankLine }] })); }
  function removeLine(idx: number) { setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) })); }
  function setLine(idx: number, key: string, val: string) {
    setForm((p) => { const items = [...p.items]; items[idx] = { ...items[idx], [key]: val }; return { ...p, items }; });
  }

  function populateLine(idx: number, itemId: string) {
    const item = inventoryItems.find((i) => String(i.id) === itemId);
    if (!item) return;
    setForm((p) => {
      const items = [...p.items];
      items[idx] = {
        ...items[idx], inventoryItemId: itemId,
        description: item.name, unitOfMeasure: item.unitOfMeasure,
        unitPriceUsd: item.unitCostUsd !== null ? String(item.unitCostUsd) : "",
      };
      return { ...p, items };
    });
  }

  function lineTotal(line: typeof blankLine) {
    const q = parseFloat(line.quantity) || 0;
    const p = parseFloat(line.unitPriceUsd) || 0;
    return q * p;
  }

  const grandTotal = useMemo(() => form.items.reduce((s, l) => s + lineTotal(l), 0), [form.items]);

  function openForm() { setForm(blankForm); setErr(""); setShow(true); }

  function submit() {
    setErr("");
    startT(async () => {
      const sup = suppliers.find((s) => String(s.id) === form.supplierId);
      const payload = {
        supplierId: Number(form.supplierId),
        prId: form.prId ? Number(form.prId) : undefined,
        warehouseId: form.warehouseId ? Number(form.warehouseId) : undefined,
        orderDate: form.orderDate,
        expectedDelivery: form.expectedDelivery || undefined,
        currency: form.currency || "USD",
        notes: form.notes || undefined,
        items: form.items.filter((i) => i.description && i.quantity && i.unitPriceUsd).map((i) => ({
          inventoryItemId: i.inventoryItemId ? Number(i.inventoryItemId) : undefined,
          description: i.description, unitOfMeasure: i.unitOfMeasure || "pcs",
          quantity: Number(i.quantity), unitPriceUsd: Number(i.unitPriceUsd),
        })),
      };
      const res = await createPurchaseOrder(payload);
      if ("error" in res) { setErr(res.error); return; }
      const wh = warehouses.find((w) => String(w.id) === form.warehouseId);
      const total = res.data.items.reduce((s: number, i) => s + Number(i.totalUsd), 0);
      setOrders((p) => [{
        id: res.data.id, poNumber: res.data.poNumber,
        supplierId: res.data.supplierId, supplierName: sup?.name ?? "", supplierCode: sup?.supplierCode ?? "",
        warehouseCode: wh?.code ?? null, status: res.data.status,
        orderDate: res.data.orderDate.toISOString(),
        expectedDelivery: res.data.expectedDelivery?.toISOString() ?? null,
        totalAmountUsd: total, currency: res.data.currency,
        notes: res.data.notes, createdBy: "Me", approvedBy: null, receiptCount: 0,
        items: res.data.items.map((i) => ({
          id: i.id, description: i.description, unitOfMeasure: i.unitOfMeasure,
          quantity: Number(i.quantity), unitPriceUsd: Number(i.unitPriceUsd),
          totalUsd: Number(i.totalUsd), receivedQty: 0,
          inventoryItemId: i.inventoryItemId, notes: i.notes,
        })),
        createdAt: res.data.createdAt.toISOString(),
      }, ...p]);
      setShow(false);
    });
  }

  function doSubmit(po: PO) {
    startT(async () => {
      const res = await submitPurchaseOrder(po.id);
      if (!("error" in res)) setOrders((p) => p.map((x) => x.id === po.id ? { ...x, status: "PENDING_APPROVAL" } : x));
    });
  }

  function doApprove(po: PO, approve: boolean) {
    startT(async () => {
      const res = await approvePurchaseOrder({ id: po.id, approve });
      if (!("error" in res)) {
        const newStatus = approve ? "APPROVED" : "CANCELLED";
        setOrders((p) => p.map((x) => x.id === po.id ? { ...x, status: newStatus, approvedBy: approve ? "Me" : null } : x));
        if (viewPO?.id === po.id) setView((v) => v ? { ...v, status: newStatus } : null);
      }
    });
  }

  function doCancel(po: PO) {
    startT(async () => {
      const res = await cancelPurchaseOrder(po.id);
      if (!("error" in res)) setOrders((p) => p.map((x) => x.id === po.id ? { ...x, status: "CANCELLED" } : x));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO#, supplier…"
          style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: 220 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Statuses</option>
          {["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((s) => <option key={s} value={s}>{STATUS_STYLE[s]?.label ?? s}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportMenu title="Purchase Orders" filename="purchase-orders" data={exportData} columns={[
            { key: "PO Number", header: "PO#" }, { key: "Supplier", header: "Supplier" },
            { key: "Order Date", header: "Order Date" }, { key: "Expected Delivery", header: "Expected" },
            { key: "Total (USD)", header: "Total (USD)" }, { key: "Status", header: "Status" },
            { key: "Created By", header: "Created By" }, { key: "Approved By", header: "Approved By" },
          ]} />
          {canManage && <button className="btn btn-primary" onClick={openForm}>+ New Order</button>}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Purchase Order</span><button className="btn btn-sm" onClick={() => setShow(false)}>×</button></div>
          <div className="panel-body">
            {err && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Supplier *</label>
                <select value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Linked PR</label>
                <select value={form.prId} onChange={(e) => setForm((p) => ({ ...p, prId: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">None</option>
                  {approvedPRs.map((pr) => <option key={pr.id} value={String(pr.id)}>{pr.prNumber}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Warehouse</label>
                <select value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Any warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code} — {w.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Order Date *</label>
                <input type="date" value={form.orderDate} onChange={(e) => setForm((p) => ({ ...p, orderDate: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Expected Delivery</label>
                <input type="date" value={form.expectedDelivery} onChange={(e) => setForm((p) => ({ ...p, expectedDelivery: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Currency</label>
                <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  {["USD", "KHR", "EUR", "CNY", "THB"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 3", display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Notes</label>
                <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Order Items *</div>
              {form.items.map((line, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Inventory Item</label>
                    <select value={line.inventoryItemId} onChange={(e) => populateLine(idx, e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }}>
                      <option value="">— None —</option>
                      {inventoryItems.map((i) => <option key={i.id} value={String(i.id)}>{i.itemCode} — {i.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Description *</label>
                    <input value={line.description} onChange={(e) => setLine(idx, "description", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>UOM</label>
                    <input value={line.unitOfMeasure} onChange={(e) => setLine(idx, "unitOfMeasure", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Qty *</label>
                    <input type="number" step="any" min="0" value={line.quantity} onChange={(e) => setLine(idx, "quantity", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Unit Price (USD) *</label>
                    <input type="number" step="any" min="0" value={line.unitPriceUsd} onChange={(e) => setLine(idx, "unitPriceUsd", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <button className="btn btn-sm" onClick={() => removeLine(idx)} style={{ color: "var(--red)" }} disabled={form.items.length === 1}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <button className="btn btn-sm" onClick={addLine}>+ Add Item</button>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--steel)" }}>Total: {fmtUsd(grandTotal)}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending || !form.supplierId || !form.orderDate}>
                {pending ? "Saving…" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Purchase Orders ({filtered.length}{filtered.length !== orders.length ? ` of ${orders.length}` : ""})</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Total</th><th>Status</th><th>By</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No purchase orders found</td></tr>}
              {filtered.map((po) => {
                const s = STATUS_STYLE[po.status] ?? STATUS_STYLE.DRAFT;
                return (
                  <tr key={po.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{po.poNumber}</code></td>
                    <td style={{ fontWeight: 500 }}>{po.supplierName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(po.orderDate)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(po.totalAmountUsd)}</td>
                    <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{po.createdBy}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => setView(po)}>View</button>
                        {canManage && po.status === "DRAFT" && <button className="btn btn-sm" onClick={() => doSubmit(po)} disabled={pending}>Submit</button>}
                        {canApprove && po.status === "PENDING_APPROVAL" && (
                          <>
                            <button className="btn btn-sm" style={{ color: "var(--green)" }} onClick={() => doApprove(po, true)} disabled={pending}>Approve</button>
                            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => doApprove(po, false)} disabled={pending}>Reject</button>
                          </>
                        )}
                        {canManage && (po.status === "DRAFT" || po.status === "PENDING_APPROVAL") && (
                          <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => doCancel(po)} disabled={pending}>Cancel</button>
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

      {/* View modal */}
      {viewPO && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }} onClick={() => setView(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 700, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{viewPO.poNumber}</h2>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>
                  {viewPO.supplierName} · Order date {fmtDate(viewPO.orderDate)}
                  {viewPO.expectedDelivery && ` · Expected ${fmtDate(viewPO.expectedDelivery)}`}
                </div>
              </div>
              {(() => { const s = STATUS_STYLE[viewPO.status] ?? STATUS_STYLE.DRAFT; return <span className="tag" style={{ background: s.bg, color: s.color, fontSize: 12.5 }}>{s.label}</span>; })()}
            </div>
            {viewPO.notes && <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 13, color: "var(--text-2)" }}>{viewPO.notes}</div>}
            <table className="data-table" style={{ marginBottom: 16 }}>
              <thead><tr><th>Description</th><th>UOM</th><th className="num">Qty</th><th className="num">Unit Price</th><th className="num">Total</th><th className="num">Received</th></tr></thead>
              <tbody>
                {viewPO.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.description}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.unitOfMeasure}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{i.quantity}</td>
                    <td className="num" style={{ color: "var(--text-2)" }}>{fmtUsd(i.unitPriceUsd)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(i.totalUsd)}</td>
                    <td className="num" style={{ color: i.receivedQty >= i.quantity ? "var(--green)" : "var(--text-2)" }}>{i.receivedQty}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 700, padding: "8px 12px", color: "var(--text-2)" }}>Grand Total</td>
                  <td className="num" style={{ fontWeight: 800, fontSize: 14, color: "var(--steel)" }}>{fmtUsd(viewPO.totalAmountUsd)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setView(null)}>Close</button>
              {canManage && viewPO.status === "DRAFT" && <button className="btn btn-primary" onClick={() => { doSubmit(viewPO); setView(null); }} disabled={pending}>Submit for Approval</button>}
              {canApprove && viewPO.status === "PENDING_APPROVAL" && (
                <>
                  <button className="btn" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={() => { doApprove(viewPO, false); }} disabled={pending}>Reject</button>
                  <button className="btn btn-primary" onClick={() => { doApprove(viewPO, true); }} disabled={pending}>Approve</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
