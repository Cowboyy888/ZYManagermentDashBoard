"use client";
import { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { recordStockTransaction } from "@/actions/inventory";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type Tx = {
  id: string; type: string; itemId: number; itemCode: string; itemName: string; uom: string;
  warehouseCode: string | null; quantity: number; unitCostUsd: number | null;
  balanceAfter: number | null; refNumber: string | null;
  productionOrderCode: string | null; note: string | null;
  createdBy: string; createdAt: string;
};
type Item      = { id: number; itemCode: string; name: string; unitOfMeasure: string; currentStock: number; warehouseId: number };
type Warehouse = { id: number; code: string; name: string };
type ProdOrder = { id: number; orderCode: string };

const TX_TYPES = ["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "RETURN", "TRANSFER"] as const;
const TX_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  STOCK_IN:   { bg: "var(--green-bg)",  color: "var(--green)",  label: "Stock In" },
  STOCK_OUT:  { bg: "var(--red-bg)",    color: "var(--red)",    label: "Stock Out" },
  ADJUSTMENT: { bg: "var(--amber-bg)",  color: "var(--amber)",  label: "Adjustment" },
  RETURN:     { bg: "var(--blue-bg)",   color: "var(--blue)",   label: "Return" },
  TRANSFER:   { bg: "var(--purple-bg)", color: "var(--purple)", label: "Transfer" },
};

const blank = { type: "STOCK_IN", itemId: "", warehouseId: "", quantity: "", unitCostUsd: "", refNumber: "", productionOrderId: "", note: "" };

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

export function TransactionsManager({
  transactions: initial,
  items,
  warehouses,
  productionOrders,
  canWrite,
}: {
  transactions: Tx[];
  items: Item[];
  warehouses: Warehouse[];
  productionOrders: ProdOrder[];
  canWrite: boolean;
}) {
  const [txs, setTxs]         = useState(initial);
  const [search, setSearch]   = useState("");
  const [filterType, setFType] = useState("");
  const [showForm, setShow]   = useState(false);
  const [form, setForm]       = useState({ ...blank });
  const [err, setErr]         = useState("");
  const [pending, startT]     = useTransition();

  const filtered = useMemo(() => txs.filter((t) => {
    if (filterType && t.type !== filterType) return false;
    if (search && !`${t.itemCode} ${t.itemName} ${t.refNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [txs, search, filterType]);

  const exportData = useMemo(() => filtered.map((t) => {
    const s = TX_STYLE[t.type];
    return {
      "Date": `${fmtDate(t.createdAt)} ${fmtTime(t.createdAt)}`,
      "Type": s?.label ?? t.type,
      "Item Code": t.itemCode, "Item Name": t.itemName, "UOM": t.uom,
      "Qty": t.quantity, "Balance After": t.balanceAfter ?? "",
      "Ref#": t.refNumber ?? "", "Note": t.note ?? "", "By": t.createdBy,
    };
  }), [filtered]);

  const selectedItem = useMemo(() => items.find((i) => String(i.id) === form.itemId) ?? null, [items, form.itemId]);

  function openForm() { setForm({ ...blank }); setErr(""); setShow(true); }
  function closeForm() { setShow(false); }

  function submit() {
    setErr("");
    if (!form.itemId || !form.quantity || !form.warehouseId) { setErr("Item, warehouse and quantity are required"); return; }
    startT(async () => {
      const res = await recordStockTransaction({
        type: form.type as typeof TX_TYPES[number],
        itemId: Number(form.itemId),
        warehouseId: Number(form.warehouseId),
        quantity: Number(form.quantity),
        unitCostUsd: form.unitCostUsd ? Number(form.unitCostUsd) : undefined,
        refNumber: form.refNumber || undefined,
        productionOrderId: form.productionOrderId ? Number(form.productionOrderId) : undefined,
        note: form.note || undefined,
      });
      if ("error" in res) { setErr(res.error); return; }
      const nd  = res.data;
      const item = items.find((i) => i.id === nd.itemId);
      const wh   = warehouses.find((w) => w.id === nd.warehouseId);
      const ord  = productionOrders.find((o) => o.id === nd.productionOrderId);
      setTxs((prev) => [{
        id: nd.id.toString(), type: nd.type, itemId: nd.itemId,
        itemCode: item?.itemCode ?? "", itemName: item?.name ?? "", uom: item?.unitOfMeasure ?? "",
        warehouseCode: wh?.code ?? null, quantity: Number(nd.quantity),
        unitCostUsd: nd.unitCostUsd !== null ? Number(nd.unitCostUsd) : null,
        balanceAfter: nd.balanceAfter !== null ? Number(nd.balanceAfter) : null,
        refNumber: nd.refNumber, productionOrderCode: ord?.orderCode ?? null,
        note: nd.note, createdBy: "Me", createdAt: nd.createdAt.toISOString(),
      }, ...prev]);
      closeForm();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, ref#…" style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: 200 }} />
        <select value={filterType} onChange={(e) => setFType(e.target.value)} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Types</option>
          {TX_TYPES.map((t) => <option key={t} value={t}>{TX_STYLE[t].label}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportMenu title="Stock Transactions" filename="stock-transactions" data={exportData} columns={[
            { key: "Date", header: "Date" }, { key: "Type", header: "Type" },
            { key: "Item Code", header: "Item Code" }, { key: "Item Name", header: "Name" }, { key: "UOM", header: "UOM" },
            { key: "Qty", header: "Qty" }, { key: "Balance After", header: "Balance" },
            { key: "Ref#", header: "Ref#" }, { key: "Note", header: "Note" }, { key: "By", header: "By" },
          ]} />
          {canWrite && <button className="btn btn-primary" onClick={openForm}>+ Record Transaction</button>}
        </div>
      </div>

      {/* Transaction form (inline) */}
      {showForm && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Stock Transaction</span><button className="btn btn-sm" onClick={closeForm}>×</button></div>
          <div className="panel-body">
            {err && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px 16px" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Type *</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  {TX_TYPES.map((t) => <option key={t} value={t}>{TX_STYLE[t].label}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Item *</label>
                <select value={form.itemId} onChange={(e) => { const it = items.find((i) => String(i.id) === e.target.value); setForm((p) => ({ ...p, itemId: e.target.value, warehouseId: it ? String(it.warehouseId) : p.warehouseId })); }} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select item</option>
                  {items.map((i) => <option key={i.id} value={String(i.id)}>{i.itemCode} — {i.name}</option>)}
                </select>
              </div>

              {selectedItem && (
                <div style={{ gridColumn: "span 2", display: "flex", gap: 16, padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>Current Stock: <strong style={{ color: "var(--text)" }}>{selectedItem.currentStock} {selectedItem.unitOfMeasure}</strong></div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Warehouse *</label>
                <select value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code} — {w.name}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Quantity *</label>
                <input type="number" step="any" min="0" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} placeholder="0" style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Unit Cost (USD)</label>
                <input type="number" step="any" min="0" value={form.unitCostUsd} onChange={(e) => setForm((p) => ({ ...p, unitCostUsd: e.target.value }))} placeholder="optional" style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Reference #</label>
                <input value={form.refNumber} onChange={(e) => setForm((p) => ({ ...p, refNumber: e.target.value }))} placeholder="PO#, DN#, etc." style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>

              {productionOrders.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Production Order</label>
                  <select value={form.productionOrderId} onChange={(e) => setForm((p) => ({ ...p, productionOrderId: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                    <option value="">None</option>
                    {productionOrders.map((o) => <option key={o.id} value={String(o.id)}>{o.orderCode}</option>)}
                  </select>
                </div>
              )}

              <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Note</label>
                <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional note" style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? "Recording…" : "Record Transaction"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">History — last 30 days ({filtered.length}{filtered.length !== txs.length ? ` of ${txs.length}` : ""})</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No transactions match filters</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date / Time</th><th>Type</th><th>Item</th><th>Warehouse</th><th>Qty</th><th>Balance</th><th>Ref#</th><th>Order</th><th>Note</th><th>By</th></tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const s = TX_STYLE[t.type] ?? TX_STYLE.ADJUSTMENT;
                  const isOut = t.type === "STOCK_OUT";
                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap", color: "var(--text-2)" }}>{fmtDate(t.createdAt)} {fmtTime(t.createdAt)}</td>
                      <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t.itemName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{t.itemCode}</div>
                      </td>
                      <td style={{ fontSize: 12 }}><code style={{ color: "var(--text-2)" }}>{t.warehouseCode ?? "—"}</code></td>
                      <td className="num" style={{ fontWeight: 700, color: isOut ? "var(--red)" : "var(--green)" }}>
                        {isOut ? "−" : "+"}{t.quantity} {t.uom}
                      </td>
                      <td className="num" style={{ color: "var(--text-2)", fontSize: 12.5 }}>{t.balanceAfter !== null ? `${t.balanceAfter} ${t.uom}` : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>{t.refNumber ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>{t.productionOrderCode ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 160 }}>{t.note ?? "—"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{t.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
