"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import dynamic from "next/dynamic";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type LowStockItem = {
  id: number; itemCode: string; name: string;
  currentStock: number; minStock: number;
  category: string; warehouseCode: string; unitOfMeasure: string;
};

type RecentTx = {
  id: string; type: string; itemCode: string; itemName: string; uom: string;
  quantity: number; balanceAfter: number | null; warehouseCode: string | null;
  refNumber: string | null; createdBy: string; createdAt: string;
};

type Summary = {
  totalItems: number;
  totalValueUsd: number;
  outOfStockCount: number;
  lowStockCount: number;
  byCategory: { code: string; count: number; value: number }[];
  byWarehouse: { code: string; count: number; value: number }[];
  warehouseList: { id: number; code: string; name: string; itemCount: number }[];
  txByType: { type: string; count: number; qty: number }[];
  lowStockItems: LowStockItem[];
  recentTransactions: RecentTx[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TX_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  STOCK_IN:   { bg: "var(--green-bg)",   color: "var(--green)",  label: "Stock In" },
  STOCK_OUT:  { bg: "var(--red-bg)",     color: "var(--red)",    label: "Stock Out" },
  ADJUSTMENT: { bg: "var(--amber-bg)",   color: "var(--amber)",  label: "Adjustment" },
  RETURN:     { bg: "var(--blue-bg)",    color: "var(--blue)",   label: "Return" },
  TRANSFER:   { bg: "var(--purple-bg)",  color: "var(--purple)", label: "Transfer" },
};

const CAT_COLORS: Record<string, string> = {
  RM: "var(--steel)", FG: "var(--green)", SP: "var(--amber)", PM: "var(--blue)",
};

function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

// ── Component ─────────────────────────────────────────────────────────────────

export function InventoryDashboard({ summary }: { summary: Summary; canWrite: boolean }) {
  const { totalItems, totalValueUsd, outOfStockCount, lowStockCount,
          byCategory, byWarehouse, warehouseList, txByType,
          lowStockItems, recentTransactions } = summary;

  const kpiExport = useMemo(() => [
    { Metric: "Total Items", Value: totalItems },
    { Metric: "Total Inventory Value (USD)", Value: fmtUsd(totalValueUsd) },
    { Metric: "Out of Stock", Value: outOfStockCount },
    { Metric: "Low Stock", Value: lowStockCount },
  ], [totalItems, totalValueUsd, outOfStockCount, lowStockCount]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Alert strip ── */}
      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {outOfStockCount > 0 && (
            <div style={{ padding: "9px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, fontWeight: 500 }}>
              {outOfStockCount} item{outOfStockCount !== 1 ? "s" : ""} out of stock — requires immediate attention
            </div>
          )}
          {lowStockCount > 0 && (
            <div style={{ padding: "9px 14px", borderRadius: 8, background: "var(--amber-bg)", color: "var(--amber)", fontSize: 13, fontWeight: 500 }}>
              {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} at or below minimum stock level
            </div>
          )}
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ExportMenu title="Inventory KPIs" filename="inventory-kpis" data={kpiExport} columns={[{ key: "Metric", header: "Metric" }, { key: "Value", header: "Value" }]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Items", value: totalItems, color: "var(--steel)" },
          { label: "Inventory Value", value: fmtUsd(totalValueUsd), color: "var(--text)" },
          { label: "Out of Stock", value: outOfStockCount, color: outOfStockCount > 0 ? "var(--red)" : "var(--text-3)" },
          { label: "Low Stock", value: lowStockCount, color: lowStockCount > 0 ? "var(--amber)" : "var(--text-3)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Value by category */}
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Value by Category (USD)</span></div>
          <div className="panel-body" style={{ padding: "12px 8px" }}>
            {byCategory.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No items yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byCategory.map((c) => ({ name: c.code, value: Math.round(c.value * 100) / 100, count: c.count }))} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} width={50} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtUsd(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Value (USD)">
                    {byCategory.map((c) => <Cell key={c.code} fill={CAT_COLORS[c.code] ?? "var(--steel)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Transactions by type (30 days) */}
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Stock Movements (30 Days)</span></div>
          <div className="panel-body" style={{ padding: "12px 8px" }}>
            {txByType.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No transactions yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                {txByType.map((t) => {
                  const s = TX_STYLE[t.type] ?? TX_STYLE.ADJUSTMENT;
                  const totalTx = txByType.reduce((a, x) => a + x.count, 0);
                  const pct = totalTx > 0 ? Math.round((t.count / totalTx) * 100) : 0;
                  return (
                    <div key={t.type}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{t.count} txns ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "var(--border)" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Warehouse cards ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Warehouse Summary</span>
          <a href="/inventory/warehouses" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Manage →</a>
        </div>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {warehouseList.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>No warehouses configured</span>
          ) : warehouseList.map((wh) => {
            const cat = byWarehouse.find((b) => b.code === wh.code);
            return (
              <div key={wh.id} style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <code style={{ fontSize: 11, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{wh.code}</code>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{wh.name}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{wh.itemCount} items</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                  {cat ? fmtUsd(Math.round(cat.value * 100) / 100) : "$0.00"} value
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Low stock alert table ── */}
      {lowStockItems.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title" style={{ color: "var(--amber)" }}>Low Stock Alerts</span>
            <a href="/inventory/items" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View Items →</a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>Current</th><th>Minimum</th><th>Status</th></tr>
              </thead>
              <tbody>
                {lowStockItems.map((i) => (
                  <tr key={i.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{i.itemCode}</code></td>
                    <td style={{ fontWeight: 500 }}>{i.name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.category}</td>
                    <td><code style={{ fontSize: 11, color: "var(--text-2)" }}>{i.warehouseCode}</code></td>
                    <td className="num" style={{ fontWeight: 700, color: i.currentStock === 0 ? "var(--red)" : "var(--amber)" }}>
                      {i.currentStock} {i.unitOfMeasure}
                    </td>
                    <td className="num" style={{ color: "var(--text-2)" }}>{i.minStock} {i.unitOfMeasure}</td>
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
        </div>
      )}

      {/* ── Recent movements ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Recent Movements (7 Days)</span>
          <a href="/inventory/transactions" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View all →</a>
        </div>
        {recentTransactions.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No stock movements yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date/Time</th><th>Type</th><th>Item</th><th>Qty</th><th>Balance</th><th>Ref</th><th>By</th></tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => {
                  const s = TX_STYLE[t.type] ?? TX_STYLE.ADJUSTMENT;
                  const isOut = t.type === "STOCK_OUT";
                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>{fmtDate(t.createdAt)} {fmtTime(t.createdAt)}</td>
                      <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{t.itemName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{t.itemCode}</div>
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: isOut ? "var(--red)" : "var(--green)" }}>
                        {isOut ? "−" : "+"}{t.quantity} {t.uom}
                      </td>
                      <td className="num" style={{ color: "var(--text-2)", fontSize: 12.5 }}>
                        {t.balanceAfter !== null ? `${t.balanceAfter} ${t.uom}` : "—"}
                      </td>
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

    </div>
  );
}
