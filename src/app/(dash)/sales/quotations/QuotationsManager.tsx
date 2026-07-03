"use client";
import { useState, useMemo, useCallback } from "react";
import { createQuotation, updateQuotationStatus, convertQuotationToOrder } from "@/actions/sales";

interface QItem { id: number; inventoryItemId: number | null; description: string; specification: string | null; unitOfMeasure: string; quantity: number; unitPriceUsd: number; discountPct: number; totalUsd: number; sortOrder: number; }
interface Quotation { id: number; quotationNumber: string; customerId: number; customerName: string; customerCode: string; status: string; validUntil: string; currency: string; subtotalUsd: number; discountUsd: number; taxUsd: number; totalUsd: number; notes: string | null; termsConditions: string | null; revision: number; createdBy: string; approvedBy: string | null; approvedAt: string | null; orderCount: number; createdAt: string; items: QItem[]; }
interface Customer { id: number; name: string; customerCode: string; paymentTerms: string | null; }
interface InventoryItem { id: number; itemCode: string; name: string; unitOfMeasure: string; }

const BLANK_LINE = { inventoryItemId: "", description: "", specification: "", unitOfMeasure: "PCS", quantity: "1", unitPriceUsd: "0", discountPct: "0" };

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#64748b", SENT: "#2563eb", APPROVED: "#16a34a",
  REJECTED: "#dc2626", EXPIRED: "#9ca3af", CONVERTED: "#7c3aed",
};

function Tag({ s }: { s: string }) {
  const c = STATUS_COLORS[s] ?? "#64748b";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c }}>{s}</span>;
}

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function QuotationsManager({ quotations: initial, customers, inventoryItems, canWrite, canApprove }: {
  quotations: Quotation[]; customers: Customer[]; inventoryItems: InventoryItem[];
  canWrite: boolean; canApprove: boolean;
}) {
  const [quotations, setQuotations] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewQ, setViewQ] = useState<Quotation | null>(null);
  const [draft, setDraftState] = useState({ customerId: "", validUntil: "", currency: "USD", discountUsd: "0", taxUsd: "0", notes: "", termsConditions: "" });
  const [lines, setLines] = useState([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return quotations.filter((qt) => {
      if (statusFilter && qt.status !== statusFilter) return false;
      if (!q) return true;
      return qt.quotationNumber.toLowerCase().includes(q) || qt.customerName.toLowerCase().includes(q);
    });
  }, [quotations, search, statusFilter]);

  const grandTotal = useMemo(() => {
    let sub = 0;
    for (const l of lines) {
      const qty = parseFloat(l.quantity) || 0;
      const price = parseFloat(l.unitPriceUsd) || 0;
      const disc = parseFloat(l.discountPct) || 0;
      sub += qty * price * (1 - disc / 100);
    }
    return sub - (parseFloat(draft.discountUsd) || 0) + (parseFloat(draft.taxUsd) || 0);
  }, [lines, draft.discountUsd, draft.taxUsd]);

  const setD = (k: string, v: string) => setDraftState((d) => ({ ...d, [k]: v }));

  const updateLine = useCallback((idx: number, k: string, v: string) => {
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, [k]: v } : l));
  }, []);

  const populateLine = useCallback((idx: number, itemId: string) => {
    const item = inventoryItems.find((i) => i.id === Number(itemId));
    if (!item) { updateLine(idx, "inventoryItemId", itemId); return; }
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, inventoryItemId: itemId, description: item.name, unitOfMeasure: item.unitOfMeasure } : l));
  }, [inventoryItems, updateLine]);

  const addLine = () => setLines((ls) => [...ls, { ...BLANK_LINE }]);
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  async function save() {
    setSaving(true); setError("");
    const payload = {
      customerId: Number(draft.customerId),
      validUntil: draft.validUntil,
      currency: draft.currency,
      discountUsd: parseFloat(draft.discountUsd) || 0,
      taxUsd: parseFloat(draft.taxUsd) || 0,
      notes: draft.notes || null,
      termsConditions: draft.termsConditions || null,
      items: lines.map((l, idx) => ({
        inventoryItemId: l.inventoryItemId ? Number(l.inventoryItemId) : null,
        description: l.description,
        specification: l.specification || null,
        unitOfMeasure: l.unitOfMeasure,
        quantity: parseFloat(l.quantity) || 0,
        unitPriceUsd: parseFloat(l.unitPriceUsd) || 0,
        discountPct: parseFloat(l.discountPct) || 0,
        sortOrder: idx,
      })),
    };
    const res = await createQuotation(payload);
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const q = res.data as unknown as Quotation;
    const cust = customers.find((c) => c.id === q.customerId);
    setQuotations((prev) => [{
      ...q,
      customerName: cust?.name ?? "", customerCode: cust?.customerCode ?? "",
      subtotalUsd: Number(q.subtotalUsd), discountUsd: Number(q.discountUsd),
      taxUsd: Number(q.taxUsd), totalUsd: Number(q.totalUsd),
      validUntil: typeof q.validUntil === "string" ? q.validUntil : (q.validUntil as Date).toISOString(),
      createdBy: "", approvedBy: null, approvedAt: null, orderCount: 0,
      items: (q.items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unitPriceUsd: Number(i.unitPriceUsd), discountPct: Number(i.discountPct), totalUsd: Number(i.totalUsd) })),
    }, ...prev]);
    setShowCreate(false);
    setDraftState({ customerId: "", validUntil: "", currency: "USD", discountUsd: "0", taxUsd: "0", notes: "", termsConditions: "" });
    setLines([{ ...BLANK_LINE }]);
  }

  async function changeStatus(id: number, status: "SENT" | "APPROVED" | "REJECTED" | "EXPIRED") {
    const res = await updateQuotationStatus({ id, status });
    if ("error" in res) return;
    setQuotations((prev) => prev.map((q) => q.id === id ? { ...q, status } : q));
  }

  async function convertToOrder(id: number) {
    const res = await convertQuotationToOrder(id);
    if ("error" in res) { alert(res.error); return; }
    setQuotations((prev) => prev.map((q) => q.id === id ? { ...q, status: "CONVERTED", orderCount: q.orderCount + 1 } : q));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" placeholder="Search number, customer..." style={{ flex: 1, minWidth: 200 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {["DRAFT","SENT","APPROVED","REJECTED","EXPIRED","CONVERTED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canWrite && <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setError(""); }}>+ New Quotation</button>}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="panel">
          <div className="panel-head">
            <h2>New Quotation</h2>
            <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
          <div className="panel-body">
            {error && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Customer *</label>
                <select className="input" value={draft.customerId} onChange={(e) => setD("customerId", e.target.value)}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Valid Until *</label>
                <input className="input" type="date" value={draft.validUntil} onChange={(e) => setD("validUntil", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Currency</label>
                <input className="input" value={draft.currency} onChange={(e) => setD("currency", e.target.value)} />
              </div>
            </div>

            {/* Line items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["Item Lookup","Description","Spec","UOM","Qty","Price","Disc%","Total",""].map((h) => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const lineTotal = (parseFloat(l.quantity)||0) * (parseFloat(l.unitPriceUsd)||0) * (1 - (parseFloat(l.discountPct)||0)/100);
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
                      <td style={{ padding: 4 }}><input style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 100 }} value={l.specification} onChange={(e) => updateLine(idx, "specification", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 60 }} value={l.unitOfMeasure} onChange={(e) => updateLine(idx, "unitOfMeasure", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input type="number" min="0" style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 70 }} value={l.quantity} onChange={(e) => updateLine(idx, "quantity", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input type="number" min="0" step="0.01" style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 80 }} value={l.unitPriceUsd} onChange={(e) => updateLine(idx, "unitPriceUsd", e.target.value)} /></td>
                      <td style={{ padding: 4 }}><input type="number" min="0" max="100" style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", width: 60 }} value={l.discountPct} onChange={(e) => updateLine(idx, "discountPct", e.target.value)} /></td>
                      <td style={{ padding: 4, fontSize: 12, fontWeight: 600, textAlign: "right", minWidth: 80 }}>{fmtUsd(lineTotal)}</td>
                      <td style={{ padding: 4 }}>{lines.length > 1 && <button onClick={() => removeLine(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 16 }}>×</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="btn btn-sm" onClick={addLine}>+ Add Line</button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Discount (USD)</label>
                <input className="input" type="number" min="0" step="0.01" value={draft.discountUsd} onChange={(e) => setD("discountUsd", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Tax (USD)</label>
                <input className="input" type="number" min="0" step="0.01" value={draft.taxUsd} onChange={(e) => setD("taxUsd", e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>Total: {fmtUsd(grandTotal)}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Notes</label>
                <textarea className="input" rows={2} value={draft.notes} onChange={(e) => setD("notes", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Terms & Conditions</label>
                <textarea className="input" rows={2} value={draft.termsConditions} onChange={(e) => setD("termsConditions", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Create Quotation"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation list */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Number</th><th>Customer</th><th>Valid Until</th><th>Status</th>
                <th style={{ textAlign: "right" }}>Total</th><th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No quotations found</td></tr>}
              {filtered.map((q) => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{q.quotationNumber}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{q.customerName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{q.customerCode}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-3)" }}>{fmtDate(q.validUntil)}</td>
                  <td><Tag s={q.status} /></td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontSize: 13 }}>{fmtUsd(q.totalUsd)}</td>
                  <td style={{ fontSize: 12 }}>{q.createdBy}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-sm" onClick={() => setViewQ(q)}>View</button>
                      {canApprove && q.status === "DRAFT" && <button className="btn btn-sm" style={{ color: "var(--blue)" }} onClick={() => changeStatus(q.id, "SENT")}>Send</button>}
                      {canApprove && q.status === "SENT" && <button className="btn btn-sm" style={{ color: "var(--green)" }} onClick={() => changeStatus(q.id, "APPROVED")}>Approve</button>}
                      {canApprove && q.status === "SENT" && <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => changeStatus(q.id, "REJECTED")}>Reject</button>}
                      {canWrite && q.status === "APPROVED" && q.orderCount === 0 && <button className="btn btn-sm" style={{ color: "var(--purple)" }} onClick={() => convertToOrder(q.id)}>Convert to Order</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal */}
      {viewQ && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setViewQ(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{viewQ.quotationNumber}</h2>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>{viewQ.customerName} · <Tag s={viewQ.status} /></div>
              </div>
              <button className="btn btn-sm" onClick={() => setViewQ(null)}>Close</button>
            </div>
            <table className="data-table" style={{ width: "100%", marginBottom: 12 }}>
              <thead>
                <tr><th>Description</th><th>Spec</th><th>UOM</th><th>Qty</th><th style={{ textAlign: "right" }}>Unit Price</th><th style={{ textAlign: "right" }}>Discount</th><th style={{ textAlign: "right" }}>Total</th></tr>
              </thead>
              <tbody>
                {viewQ.items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontSize: 13 }}>{i.description}</td>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{i.specification ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>{i.unitOfMeasure}</td>
                    <td style={{ fontSize: 13 }}>{i.quantity}</td>
                    <td style={{ textAlign: "right", fontSize: 13 }}>{fmtUsd(i.unitPriceUsd)}</td>
                    <td style={{ textAlign: "right", fontSize: 12 }}>{i.discountPct}%</td>
                    <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{fmtUsd(i.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={6} style={{ textAlign: "right", fontSize: 12, color: "var(--text-3)", padding: "6px 8px" }}>Subtotal</td><td style={{ textAlign: "right", fontWeight: 600, padding: "6px 8px" }}>{fmtUsd(viewQ.subtotalUsd)}</td></tr>
                {viewQ.discountUsd > 0 && <tr><td colSpan={6} style={{ textAlign: "right", fontSize: 12, color: "var(--red)", padding: "4px 8px" }}>Discount</td><td style={{ textAlign: "right", color: "var(--red)", padding: "4px 8px" }}>−{fmtUsd(viewQ.discountUsd)}</td></tr>}
                {viewQ.taxUsd > 0 && <tr><td colSpan={6} style={{ textAlign: "right", fontSize: 12, padding: "4px 8px" }}>Tax</td><td style={{ textAlign: "right", padding: "4px 8px" }}>{fmtUsd(viewQ.taxUsd)}</td></tr>}
                <tr style={{ background: "var(--surface-2)" }}><td colSpan={6} style={{ textAlign: "right", fontWeight: 700, padding: "8px" }}>TOTAL ({viewQ.currency})</td><td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", fontSize: 16, padding: "8px" }}>{fmtUsd(viewQ.totalUsd)}</td></tr>
              </tfoot>
            </table>
            {viewQ.notes && <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 8 }}><strong>Notes:</strong> {viewQ.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
