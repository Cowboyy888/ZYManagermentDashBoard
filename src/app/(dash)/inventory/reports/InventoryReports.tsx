"use client";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import dynamic from "next/dynamic";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type Item = {
  id: number; itemCode: string; name: string;
  categoryCode: string; categoryName: string;
  warehouseCode: string; warehouseName: string;
  unitOfMeasure: string; minStock: number; maxStock: number | null;
  currentStock: number; unitCostUsd: number | null; totalValue: number; status: string;
};
type Tx = {
  id: string; type: string; itemCode: string; itemName: string; uom: string;
  warehouseCode: string | null; quantity: number; unitCostUsd: number | null;
  balanceAfter: number | null; refNumber: string | null;
  createdBy: string; createdAt: string;
};

const REPORT_TABS = ["Stock Summary", "Valuation", "Movements", "Low Stock"] as const;
type ReportTab = typeof REPORT_TABS[number];

const TX_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  STOCK_IN:   { bg: "var(--green-bg)",  color: "var(--green)",  label: "Stock In" },
  STOCK_OUT:  { bg: "var(--red-bg)",    color: "var(--red)",    label: "Stock Out" },
  ADJUSTMENT: { bg: "var(--amber-bg)",  color: "var(--amber)",  label: "Adjustment" },
  RETURN:     { bg: "var(--blue-bg)",   color: "var(--blue)",   label: "Return" },
  TRANSFER:   { bg: "var(--purple-bg)", color: "var(--purple)", label: "Transfer" },
};

const CAT_COLORS: Record<string, string> = {
  RM: "var(--steel)", FG: "var(--green)", SP: "var(--amber)", PM: "var(--blue)",
};

function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

export function InventoryReports({
  items,
  transactions,
  canExport,
}: {
  items: Item[];
  transactions: Tx[];
  canExport: boolean;
}) {
  const [tab, setTab] = useState<ReportTab>("Stock Summary");

  // ── Stock Summary ──────────────────────────────────────────────────────────
  const stockExport = useMemo(() => items.map((i) => ({
    "Code": i.itemCode, "Name": i.name, "Category": i.categoryCode,
    "Warehouse": i.warehouseCode, "UOM": i.unitOfMeasure, "Stock": i.currentStock,
    "Min": i.minStock, "Max": i.maxStock ?? "", "Status": i.status,
  })), [items]);

  // ── Valuation ──────────────────────────────────────────────────────────────
  const totalValue = useMemo(() => { let sum = 0; for (const i of items) sum += i.totalValue; return sum; }, [items]);
  const byCategory = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    for (const i of items) {
      if (!map[i.categoryCode]) map[i.categoryCode] = { count: 0, value: 0 };
      map[i.categoryCode].count++;
      map[i.categoryCode].value += i.totalValue;
    }
    return Object.entries(map).map(([code, v]) => ({ code, ...v })).sort((a, b) => b.value - a.value);
  }, [items]);

  const valuationExport = useMemo(() => items.filter((i) => i.totalValue > 0).sort((a, b) => b.totalValue - a.totalValue).map((i) => ({
    "Code": i.itemCode, "Name": i.name, "Category": i.categoryCode, "Warehouse": i.warehouseCode,
    "UOM": i.unitOfMeasure, "Stock": i.currentStock, "Unit Cost (USD)": i.unitCostUsd?.toFixed(4) ?? "",
    "Total Value (USD)": i.totalValue.toFixed(2),
  })), [items]);

  // ── Movements ─────────────────────────────────────────────────────────────
  const movementExport = useMemo(() => transactions.map((t) => ({
    "Date": `${fmtDate(t.createdAt)} ${fmtTime(t.createdAt)}`,
    "Type": TX_STYLE[t.type]?.label ?? t.type,
    "Item Code": t.itemCode, "Item Name": t.itemName, "UOM": t.uom,
    "Qty": t.quantity, "Balance": t.balanceAfter ?? "", "Ref#": t.refNumber ?? "", "By": t.createdBy,
  })), [transactions]);

  // ── Low Stock ─────────────────────────────────────────────────────────────
  const lowStockItems = useMemo(() => items.filter((i) => i.currentStock <= i.minStock).sort((a, b) => (a.currentStock / Math.max(a.minStock, 1)) - (b.currentStock / Math.max(b.minStock, 1))), [items]);
  const lowStockExport = useMemo(() => lowStockItems.map((i) => ({
    "Code": i.itemCode, "Name": i.name, "Category": i.categoryCode, "Warehouse": i.warehouseCode,
    "UOM": i.unitOfMeasure, "Current Stock": i.currentStock, "Min Stock": i.minStock,
    "Alert": i.currentStock === 0 ? "OUT OF STOCK" : "LOW STOCK",
  })), [lowStockItems]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)" }}>
        {REPORT_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: "6px 6px 0 0", border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 500, background: tab === t ? "var(--surface)" : "transparent", color: tab === t ? "var(--steel)" : "var(--text-2)", borderBottom: tab === t ? "2px solid var(--steel)" : "2px solid transparent" }}>
            {t}{t === "Low Stock" && lowStockItems.length > 0 && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 10, background: "var(--amber-bg)", color: "var(--amber)", fontSize: 10.5, fontWeight: 700 }}>{lowStockItems.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Stock Summary ── */}
      {tab === "Stock Summary" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Stock Summary ({items.length} items)</span>
            {canExport && <ExportMenu title="Stock Summary" filename="stock-summary" data={stockExport} columns={[
              { key: "Code", header: "Code" }, { key: "Name", header: "Name" }, { key: "Category", header: "Cat" },
              { key: "Warehouse", header: "WH" }, { key: "UOM", header: "UOM" }, { key: "Stock", header: "Stock" },
              { key: "Min", header: "Min" }, { key: "Max", header: "Max" }, { key: "Status", header: "Status" },
            ]} />}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>UOM</th><th>Stock</th><th>Min</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No items</td></tr>}
                {items.map((i) => (
                  <tr key={i.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{i.itemCode}</code></td>
                    <td style={{ fontWeight: 500 }}>{i.name}</td>
                    <td><span className="tag">{i.categoryCode}</span></td>
                    <td><code style={{ fontSize: 11, color: "var(--text-2)" }}>{i.warehouseCode}</code></td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.unitOfMeasure}</td>
                    <td className="num" style={{ fontWeight: 700, color: i.currentStock === 0 ? "var(--red)" : i.currentStock <= i.minStock ? "var(--amber)" : "var(--text)" }}>{i.currentStock}</td>
                    <td className="num" style={{ color: "var(--text-2)", fontSize: 12.5 }}>{i.minStock}</td>
                    <td>
                      {i.currentStock === 0
                        ? <span className="tag" style={{ background: "var(--red-bg)", color: "var(--red)" }}>Out of Stock</span>
                        : i.currentStock <= i.minStock
                          ? <span className="tag" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>Low Stock</span>
                          : <span className="tag" style={{ background: "var(--green-bg)", color: "var(--green)" }}>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Valuation ── */}
      {tab === "Valuation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Total Value", value: fmtUsd(totalValue), color: "var(--steel)" },
              { label: "Valued Items", value: items.filter((i) => i.totalValue > 0).length, color: "var(--text)" },
              { label: "Zero-Value Items", value: items.filter((i) => i.totalValue === 0).length, color: "var(--text-2)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="kpi-card">
                <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head"><span className="panel-title">Value by Category</span></div>
              <div style={{ padding: "12px 8px" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byCategory.map((c) => ({ name: c.code, value: Math.round(c.value * 100) / 100 }))} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} width={60} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtUsd(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {byCategory.map((c) => <Cell key={c.code} fill={CAT_COLORS[c.code] ?? "var(--steel)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><span className="panel-title">Category Breakdown</span></div>
              <div style={{ padding: 12 }}>
                {byCategory.map((c) => (
                  <div key={c.code} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{c.code} ({c.count} items)</span>
                      <span style={{ color: "var(--steel)", fontWeight: 700 }}>{fmtUsd(c.value)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "var(--border)" }}>
                      <div style={{ width: `${totalValue > 0 ? Math.round((c.value / totalValue) * 100) : 0}%`, height: "100%", background: CAT_COLORS[c.code] ?? "var(--steel)", borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Valuation Detail</span>
              {canExport && <ExportMenu title="Inventory Valuation" filename="inventory-valuation" data={valuationExport} columns={[
                { key: "Code", header: "Code" }, { key: "Name", header: "Name" }, { key: "Category", header: "Cat" },
                { key: "Warehouse", header: "WH" }, { key: "UOM", header: "UOM" }, { key: "Stock", header: "Stock" },
                { key: "Unit Cost (USD)", header: "Unit Cost" }, { key: "Total Value (USD)", header: "Total Value" },
              ]} />}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>Stock</th><th>Unit Cost</th><th>Total Value</th></tr>
                </thead>
                <tbody>
                  {items.filter((i) => i.totalValue > 0).sort((a, b) => b.totalValue - a.totalValue).map((i) => (
                    <tr key={i.id}>
                      <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{i.itemCode}</code></td>
                      <td style={{ fontWeight: 500 }}>{i.name}</td>
                      <td><span className="tag">{i.categoryCode}</span></td>
                      <td><code style={{ fontSize: 11, color: "var(--text-2)" }}>{i.warehouseCode}</code></td>
                      <td className="num">{i.currentStock} {i.unitOfMeasure}</td>
                      <td className="num" style={{ color: "var(--text-2)", fontSize: 12.5 }}>{i.unitCostUsd !== null ? `$${i.unitCostUsd.toFixed(4)}` : "—"}</td>
                      <td className="num" style={{ fontWeight: 700, color: "var(--steel)" }}>{fmtUsd(i.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Movements ── */}
      {tab === "Movements" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Stock Movements — Last 30 Days ({transactions.length})</span>
            {canExport && <ExportMenu title="Stock Movements" filename="stock-movements" data={movementExport} columns={[
              { key: "Date", header: "Date" }, { key: "Type", header: "Type" },
              { key: "Item Code", header: "Code" }, { key: "Item Name", header: "Name" }, { key: "UOM", header: "UOM" },
              { key: "Qty", header: "Qty" }, { key: "Balance", header: "Balance" }, { key: "Ref#", header: "Ref#" }, { key: "By", header: "By" },
            ]} />}
          </div>
          {transactions.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No transactions in last 30 days</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr><th>Date / Time</th><th>Type</th><th>Item</th><th>Warehouse</th><th>Qty</th><th>Balance</th><th>Ref#</th><th>By</th></tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const s = TX_STYLE[t.type] ?? TX_STYLE.ADJUSTMENT;
                    const isOut = t.type === "STOCK_OUT";
                    return (
                      <tr key={t.id}>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap", color: "var(--text-2)" }}>{fmtDate(t.createdAt)} {fmtTime(t.createdAt)}</td>
                        <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{t.itemName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{t.itemCode}</div>
                        </td>
                        <td><code style={{ fontSize: 11, color: "var(--text-2)" }}>{t.warehouseCode ?? "—"}</code></td>
                        <td className="num" style={{ fontWeight: 700, color: isOut ? "var(--red)" : "var(--green)" }}>{isOut ? "−" : "+"}{t.quantity} {t.uom}</td>
                        <td className="num" style={{ color: "var(--text-2)", fontSize: 12.5 }}>{t.balanceAfter !== null ? `${t.balanceAfter} ${t.uom}` : "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-3)" }}>{t.refNumber ?? "—"}</td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{t.createdBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Low Stock ── */}
      {tab === "Low Stock" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title" style={{ color: "var(--amber)" }}>Low Stock Alerts ({lowStockItems.length})</span>
            {canExport && lowStockItems.length > 0 && <ExportMenu title="Low Stock Report" filename="low-stock" data={lowStockExport} columns={[
              { key: "Code", header: "Code" }, { key: "Name", header: "Name" }, { key: "Category", header: "Cat" },
              { key: "Warehouse", header: "WH" }, { key: "UOM", header: "UOM" }, { key: "Current Stock", header: "Stock" },
              { key: "Min Stock", header: "Min" }, { key: "Alert", header: "Alert" },
            ]} />}
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--green)", fontSize: 14, fontWeight: 600 }}>All items are above minimum stock levels</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>UOM</th><th>Current Stock</th><th>Min Stock</th><th>Alert</th></tr>
                </thead>
                <tbody>
                  {lowStockItems.map((i) => (
                    <tr key={i.id}>
                      <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{i.itemCode}</code></td>
                      <td style={{ fontWeight: 500 }}>{i.name}</td>
                      <td><span className="tag">{i.categoryCode}</span></td>
                      <td><code style={{ fontSize: 11, color: "var(--text-2)" }}>{i.warehouseCode}</code></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.unitOfMeasure}</td>
                      <td className="num" style={{ fontWeight: 700, color: i.currentStock === 0 ? "var(--red)" : "var(--amber)" }}>{i.currentStock}</td>
                      <td className="num" style={{ color: "var(--text-2)" }}>{i.minStock}</td>
                      <td>
                        <span className="tag" style={i.currentStock === 0 ? { background: "var(--red-bg)", color: "var(--red)" } : { background: "var(--amber-bg)", color: "var(--amber)" }}>
                          {i.currentStock === 0 ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
