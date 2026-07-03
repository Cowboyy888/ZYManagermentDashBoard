"use client";
import { useState, useMemo } from "react";
import { createDelivery, updateDeliveryStatus } from "@/actions/sales";

interface DItem { id: number; orderItemId: number; inventoryItemId: number | null; description: string; unitOfMeasure: string; quantity: number; }
interface Delivery { id: number; deliveryNumber: string; orderId: number; orderNumber: string; customerName: string; status: string; scheduledDate: string; deliveredDate: string | null; carrier: string | null; trackingNumber: string | null; notes: string | null; createdBy: string; createdAt: string; items: DItem[]; }
interface SOItem { id: number; inventoryItemId: number | null; description: string; unitOfMeasure: string; quantity: number; deliveredQty: number; }
interface ShipableOrder { id: number; orderNumber: string; customerName: string; items: SOItem[]; }

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#2563eb", IN_TRANSIT: "#d97706", DELIVERED: "#16a34a", FAILED: "#dc2626",
};

function Tag({ s }: { s: string }) {
  const c = STATUS_COLORS[s] ?? "#64748b";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c }}>{s.replace(/_/g, " ")}</span>;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function DeliveriesManager({ deliveries: initial, shipableOrders, canWrite }: {
  deliveries: Delivery[]; shipableOrders: ShipableOrder[]; canWrite: boolean;
}) {
  const [deliveries, setDeliveries] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewDel, setViewDel] = useState<Delivery | null>(null);
  const [draft, setDraftState] = useState({ orderId: "", scheduledDate: new Date().toISOString().slice(0, 10), carrier: "", trackingNumber: "", notes: "" });
  const [receiveLines, setReceiveLines] = useState<{ orderItemId: number; inventoryItemId: number | null; description: string; unitOfMeasure: string; remaining: number; qty: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deliveredDate, setDeliveredDate] = useState(new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (!q) return true;
      return d.deliveryNumber.toLowerCase().includes(q) || d.customerName.toLowerCase().includes(q) || d.orderNumber.toLowerCase().includes(q);
    });
  }, [deliveries, search, statusFilter]);

  const setD = (k: string, v: string) => setDraftState((d) => ({ ...d, [k]: v }));

  function selectOrder(orderId: string) {
    setD("orderId", orderId);
    const order = shipableOrders.find((o) => o.id === Number(orderId));
    if (!order) { setReceiveLines([]); return; }
    setReceiveLines(order.items
      .filter((i) => i.deliveredQty < i.quantity)
      .map((i) => ({
        orderItemId: i.id, inventoryItemId: i.inventoryItemId,
        description: i.description, unitOfMeasure: i.unitOfMeasure,
        remaining: i.quantity - i.deliveredQty,
        qty: String(i.quantity - i.deliveredQty),
      }))
    );
  }

  async function save() {
    setSaving(true); setError("");
    const res = await createDelivery({
      orderId: Number(draft.orderId),
      scheduledDate: draft.scheduledDate,
      carrier: draft.carrier || null,
      trackingNumber: draft.trackingNumber || null,
      notes: draft.notes || null,
      items: receiveLines.filter((l) => parseFloat(l.qty) > 0).map((l) => ({
        orderItemId: l.orderItemId,
        inventoryItemId: l.inventoryItemId,
        quantity: parseFloat(l.qty) || 0,
      })),
    });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data as unknown as Delivery;
    const order = shipableOrders.find((o) => o.id === Number(draft.orderId));
    setDeliveries((prev) => [{
      ...d, orderNumber: order?.orderNumber ?? "", customerName: order?.customerName ?? "",
      status: "SCHEDULED", scheduledDate: draft.scheduledDate,
      deliveredDate: null, carrier: draft.carrier || null, trackingNumber: draft.trackingNumber || null,
      notes: draft.notes || null, createdBy: "", items: receiveLines.filter((l) => parseFloat(l.qty) > 0).map((l, i) => ({
        id: i, orderItemId: l.orderItemId, inventoryItemId: l.inventoryItemId,
        description: l.description, unitOfMeasure: l.unitOfMeasure, quantity: parseFloat(l.qty) || 0,
      })),
    }, ...prev]);
    setShowCreate(false);
    setDraftState({ orderId: "", scheduledDate: new Date().toISOString().slice(0, 10), carrier: "", trackingNumber: "", notes: "" });
    setReceiveLines([]);
  }

  async function changeStatus(id: number, status: "IN_TRANSIT" | "DELIVERED" | "FAILED") {
    const res = await updateDeliveryStatus({ id, status, deliveredDate: status === "DELIVERED" ? deliveredDate : undefined });
    if ("error" in res) { alert(res.error); return; }
    setDeliveries((prev) => prev.map((d) => d.id === id ? { ...d, status, deliveredDate: status === "DELIVERED" ? deliveredDate : d.deliveredDate } : d));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" placeholder="Search DN#, customer, order..." style={{ flex: 1, minWidth: 200 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {["SCHEDULED","IN_TRANSIT","DELIVERED","FAILED"].map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        {canWrite && <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setError(""); }}>+ New Delivery</button>}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel">
          <div className="panel-head">
            <h2>New Delivery Note</h2>
            <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
          <div className="panel-body">
            {error && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Sales Order *</label>
                <select className="input" value={draft.orderId} onChange={(e) => selectOrder(e.target.value)}>
                  <option value="">Select order…</option>
                  {shipableOrders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Scheduled Date *</label>
                <input className="input" type="date" value={draft.scheduledDate} onChange={(e) => setD("scheduledDate", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Carrier</label>
                <input className="input" value={draft.carrier} onChange={(e) => setD("carrier", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Tracking #</label>
                <input className="input" value={draft.trackingNumber} onChange={(e) => setD("trackingNumber", e.target.value)} />
              </div>
            </div>

            {receiveLines.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Description","UOM","Remaining","Quantity to Ship"].map((h) => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receiveLines.map((l, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: 8, fontSize: 13 }}>{l.description}</td>
                      <td style={{ padding: 8, fontSize: 12 }}>{l.unitOfMeasure}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{l.remaining}</td>
                      <td style={{ padding: 8 }}>
                        <input type="number" min="0" max={l.remaining} step="0.001"
                          style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 100 }}
                          value={l.qty}
                          onChange={(e) => setReceiveLines((ls) => ls.map((r, i) => i === idx ? { ...r, qty: e.target.value } : r))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Notes</label>
              <textarea className="input" rows={2} value={draft.notes} onChange={(e) => setD("notes", e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !draft.orderId}>{saving ? "Saving…" : "Create Delivery"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>DN#</th><th>Order</th><th>Customer</th><th>Scheduled</th>
                <th>Delivered</th><th>Carrier</th><th>Status</th>
                {canWrite && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No deliveries found</td></tr>}
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{d.deliveryNumber}</td>
                  <td style={{ fontSize: 12, fontFamily: "monospace" }}>{d.orderNumber}</td>
                  <td style={{ fontSize: 13 }}>{d.customerName}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(d.scheduledDate)}</td>
                  <td style={{ fontSize: 12, color: "var(--text-3)" }}>{d.deliveredDate ? fmtDate(d.deliveredDate) : "—"}</td>
                  <td style={{ fontSize: 12 }}>{d.carrier ?? "—"}</td>
                  <td><Tag s={d.status} /></td>
                  {canWrite && (
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <button className="btn btn-sm" onClick={() => setViewDel(d)}>View</button>
                        {d.status === "SCHEDULED" && <button className="btn btn-sm" style={{ color: "var(--amber)" }} onClick={() => changeStatus(d.id, "IN_TRANSIT")}>Ship</button>}
                        {d.status === "IN_TRANSIT" && (
                          <>
                            <input type="date" style={{ fontSize: 11, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)" }}
                              value={deliveredDate} onChange={(e) => setDeliveredDate(e.target.value)} />
                            <button className="btn btn-sm" style={{ color: "var(--green)" }} onClick={() => changeStatus(d.id, "DELIVERED")}>Mark Delivered</button>
                            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => changeStatus(d.id, "FAILED")}>Failed</button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal */}
      {viewDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setViewDel(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{viewDel.deliveryNumber}</h2>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>{viewDel.customerName} · {viewDel.orderNumber} · <Tag s={viewDel.status} /></div>
              </div>
              <button className="btn btn-sm" onClick={() => setViewDel(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, fontSize: 13 }}>
              <div><strong>Scheduled:</strong> {fmtDate(viewDel.scheduledDate)}</div>
              <div><strong>Delivered:</strong> {viewDel.deliveredDate ? fmtDate(viewDel.deliveredDate) : "—"}</div>
              <div><strong>Carrier:</strong> {viewDel.carrier ?? "—"}</div>
              <div><strong>Tracking:</strong> {viewDel.trackingNumber ?? "—"}</div>
            </div>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>Description</th><th>UOM</th><th style={{ textAlign: "right" }}>Qty</th></tr>
              </thead>
              <tbody>
                {viewDel.items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontSize: 13 }}>{i.description}</td>
                    <td style={{ fontSize: 12 }}>{i.unitOfMeasure}</td>
                    <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{i.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewDel.notes && <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 12 }}><strong>Notes:</strong> {viewDel.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
