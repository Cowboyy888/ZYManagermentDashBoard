"use client";
import { useState, useTransition, useMemo } from "react";
import { createGoodsReceipt } from "@/actions/purchasing";

type GRItemView = { poItemDescription: string; poItemQty: number; uom: string; receivedQty: number; rejectedQty: number; notes: string | null };
type GR = { id: string; receiptNumber: string; poId: number; poNumber: string; supplierName: string; warehouseCode: string; warehouseName: string; status: string; receivedBy: string; receivedDate: string; notes: string | null; items: GRItemView[]; createdAt: string };
type POItemRef = { id: number; description: string; unitOfMeasure: string; quantity: number; receivedQty: number; inventoryItemId: number | null };
type ReceivablePO = { id: number; poNumber: string; supplierName: string; status: string; warehouseId: number | null; items: POItemRef[] };
type Warehouse = { id: number; code: string; name: string };

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export function ReceiptsManager({ receipts: initial, receivablePOs, warehouses, canWrite }: {
  receipts: GR[]; receivablePOs: ReceivablePO[]; warehouses: Warehouse[]; canWrite: boolean;
}) {
  const [receipts, setReceipts] = useState(initial);
  const [viewGR, setView]       = useState<GR | null>(null);
  const [showForm, setShow]     = useState(false);
  const [selectedPO, setPO]     = useState<ReceivablePO | null>(null);
  const [receiveLines, setLines] = useState<{ poItemId: number; description: string; uom: string; ordered: number; prevReceived: number; receivedQty: string; rejectedQty: string; notes: string }[]>([]);
  const [warehouseId, setWhId]  = useState("");
  const [receivedDate, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [grNotes, setGRNotes]   = useState("");
  const [err, setErr]           = useState("");
  const [pending, startT]       = useTransition();

  function selectPO(poId: string) {
    const po = receivablePOs.find((p) => String(p.id) === poId);
    if (!po) { setPO(null); setLines([]); return; }
    setPO(po);
    setWhId(po.warehouseId !== null ? String(po.warehouseId) : "");
    setLines(po.items.map((i) => ({
      poItemId: i.id, description: i.description, uom: i.unitOfMeasure,
      ordered: i.quantity, prevReceived: i.receivedQty,
      receivedQty: String(Math.max(0, i.quantity - i.receivedQty)),
      rejectedQty: "0", notes: "",
    })));
  }

  function updateLine(idx: number, key: string, val: string) {
    setLines((p) => { const l = [...p]; l[idx] = { ...l[idx], [key]: val }; return l; });
  }

  function openForm() { setPO(null); setLines([]); setWhId(""); setGRNotes(""); setErr(""); setDate(new Date().toISOString().slice(0, 10)); setShow(true); }

  function submit() {
    setErr("");
    if (!selectedPO) { setErr("Select a purchase order"); return; }
    if (!warehouseId) { setErr("Select a warehouse"); return; }
    const validLines = receiveLines.filter((l) => Number(l.receivedQty) > 0 || Number(l.rejectedQty) > 0);
    if (validLines.length === 0) { setErr("Enter received or rejected quantities for at least one item"); return; }

    startT(async () => {
      const payload = {
        poId: selectedPO.id, warehouseId: Number(warehouseId),
        receivedDate, notes: grNotes || undefined,
        items: validLines.map((l) => ({
          poItemId: l.poItemId,
          receivedQty: Number(l.receivedQty),
          rejectedQty: Number(l.rejectedQty),
          notes: l.notes || undefined,
        })),
      };
      const res = await createGoodsReceipt(payload);
      if ("error" in res) { setErr(res.error); return; }
      const wh = warehouses.find((w) => String(w.id) === warehouseId);
      setReceipts((p) => [{
        id: res.data.id.toString(), receiptNumber: res.data.receiptNumber,
        poId: selectedPO.id, poNumber: selectedPO.poNumber, supplierName: selectedPO.supplierName,
        warehouseCode: wh?.code ?? "", warehouseName: wh?.name ?? "",
        status: res.data.status, receivedBy: "Me",
        receivedDate: res.data.receivedDate.toISOString(),
        notes: res.data.notes,
        items: validLines.map((l) => ({
          poItemDescription: l.description, poItemQty: l.ordered, uom: l.uom,
          receivedQty: Number(l.receivedQty), rejectedQty: Number(l.rejectedQty), notes: l.notes || null,
        })),
        createdAt: res.data.createdAt.toISOString(),
      }, ...p]);
      setShow(false);
    });
  }

  const pendingCount = useMemo(() => receiveLines.reduce((s, l) => {
    const rem = l.ordered - l.prevReceived;
    return s + (rem > 0 ? 1 : 0);
  }, 0), [receiveLines]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>
          {receivablePOs.length === 0 ? "No approved orders awaiting receipt" : `${receivablePOs.length} order${receivablePOs.length !== 1 ? "s" : ""} available to receive`}
        </div>
        {canWrite && <button className="btn btn-primary" onClick={openForm} disabled={receivablePOs.length === 0}>+ Record Receipt</button>}
      </div>

      {/* Receipt form */}
      {showForm && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Goods Receipt</span><button className="btn btn-sm" onClick={() => setShow(false)}>×</button></div>
          <div className="panel-body">
            {err && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 16px", marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 1" }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Purchase Order *</label>
                <select onChange={(e) => selectPO(e.target.value)} defaultValue=""
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select PO…</option>
                  {receivablePOs.map((po) => <option key={po.id} value={String(po.id)}>{po.poNumber} — {po.supplierName}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Warehouse *</label>
                <select value={warehouseId} onChange={(e) => setWhId(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code} — {w.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Received Date *</label>
                <input type="date" value={receivedDate} onChange={(e) => setDate(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
              <div style={{ gridColumn: "span 3", display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Notes</label>
                <input value={grNotes} onChange={(e) => setGRNotes(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
            </div>

            {receiveLines.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
                  Line Items ({pendingCount} item{pendingCount !== 1 ? "s" : ""} pending)
                </div>
                <table className="data-table">
                  <thead><tr><th>Item</th><th>UOM</th><th className="num">Ordered</th><th className="num">Previously Received</th><th className="num">Remaining</th><th className="num">Receiving Now</th><th className="num">Rejected</th><th>Notes</th></tr></thead>
                  <tbody>
                    {receiveLines.map((line, idx) => {
                      const remaining = line.ordered - line.prevReceived;
                      return (
                        <tr key={idx} style={{ background: remaining <= 0 ? "var(--surface-2)" : undefined }}>
                          <td style={{ fontWeight: 500, color: remaining <= 0 ? "var(--text-3)" : undefined }}>{line.description}</td>
                          <td style={{ fontSize: 12, color: "var(--text-2)" }}>{line.uom}</td>
                          <td className="num">{line.ordered}</td>
                          <td className="num" style={{ color: "var(--text-2)" }}>{line.prevReceived}</td>
                          <td className="num" style={{ fontWeight: 700, color: remaining > 0 ? "var(--amber)" : "var(--green)" }}>{remaining}</td>
                          <td className="num">
                            <input type="number" step="any" min="0" max={String(remaining)} value={line.receivedQty}
                              onChange={(e) => updateLine(idx, "receivedQty", e.target.value)}
                              disabled={remaining <= 0}
                              style={{ width: 70, padding: "4px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, textAlign: "right" }} />
                          </td>
                          <td className="num">
                            <input type="number" step="any" min="0" value={line.rejectedQty}
                              onChange={(e) => updateLine(idx, "rejectedQty", e.target.value)}
                              disabled={remaining <= 0}
                              style={{ width: 60, padding: "4px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, textAlign: "right" }} />
                          </td>
                          <td>
                            <input value={line.notes} onChange={(e) => updateLine(idx, "notes", e.target.value)}
                              placeholder="optional"
                              style={{ width: "100%", padding: "4px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending || !selectedPO || !warehouseId}>
                {pending ? "Saving…" : "Record Receipt & Update Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Goods Receipts ({receipts.length})</span></div>
        {receipts.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No goods receipts yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Receipt</th><th>Purchase Order</th><th>Supplier</th><th>Warehouse</th><th>Date</th><th>Received By</th><th>Actions</th></tr></thead>
              <tbody>
                {receipts.map((gr) => (
                  <tr key={gr.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{gr.receiptNumber}</code></td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{gr.poNumber}</td>
                    <td style={{ fontWeight: 500 }}>{gr.supplierName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{gr.warehouseCode}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(gr.receivedDate)}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{gr.receivedBy}</td>
                    <td><button className="btn btn-sm" onClick={() => setView(gr)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View modal */}
      {viewGR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }} onClick={() => setView(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 640, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{viewGR.receiptNumber}</h2>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>
                  PO: {viewGR.poNumber} · {viewGR.supplierName} · {viewGR.warehouseCode}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  Received {fmtDate(viewGR.receivedDate)} by {viewGR.receivedBy}
                </div>
              </div>
              <span className="tag" style={{ background: "var(--green-bg)", color: "var(--green)" }}>{viewGR.status}</span>
            </div>
            {viewGR.notes && <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 13, color: "var(--text-2)" }}>{viewGR.notes}</div>}
            <table className="data-table" style={{ marginBottom: 16 }}>
              <thead><tr><th>Item</th><th>UOM</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Rejected</th></tr></thead>
              <tbody>
                {viewGR.items.map((i, idx) => (
                  <tr key={idx}>
                    <td>{i.poItemDescription}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.uom}</td>
                    <td className="num">{i.poItemQty}</td>
                    <td className="num" style={{ fontWeight: 700, color: "var(--green)" }}>{i.receivedQty}</td>
                    <td className="num" style={{ color: i.rejectedQty > 0 ? "var(--red)" : "var(--text-3)" }}>{i.rejectedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
