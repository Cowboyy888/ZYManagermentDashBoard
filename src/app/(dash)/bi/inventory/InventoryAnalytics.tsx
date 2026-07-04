"use client";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  totalItems: number; totalValueUsd: number; outOfStockCount: number; lowStockCount: number;
  byCategory: { code: string; count: number; value: number }[];
  byWarehouse: { code: string; count: number; value: number }[];
  txByType: { type: string; count: number; qty: number }[];
  lowStockItems: { id: number; itemCode: string; name: string; currentStock: number; minStock: number; category: string; warehouseCode: string; unitOfMeasure: string }[];
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#f97316"];

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }

export function InventoryAnalytics({ data }: { data: Data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{data.totalItems}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Inventory Value</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{fmtUsd(data.totalValueUsd)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.lowStockCount > 0 ? "#f59e0b" : "#10b981"}` }}>
          <div className="kpi-label">Low Stock Items</div>
          <div className="kpi-value" style={{ color: data.lowStockCount > 0 ? "#f59e0b" : "#10b981" }}>{data.lowStockCount}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.outOfStockCount > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Out of Stock</div>
          <div className="kpi-value" style={{ color: data.outOfStockCount > 0 ? "#ef4444" : "#10b981" }}>{data.outOfStockCount}</div>
        </div>
      </div>

      {/* Category + Warehouse charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Value by Category</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Value"]} />
                <Bar dataKey="value" name="Value" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Distribution by Warehouse</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.byWarehouse} dataKey="value" nameKey="code" cx="50%" cy="50%" outerRadius={80} label={({ code, percent }) => `${code} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {data.byWarehouse.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Value"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transaction types */}
      <div className="panel">
        <div className="panel-head">Stock Transactions (Last 30 Days)</div>
        <div className="panel-body">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.txByType.map((t, i) => (
              <div key={t.type} style={{ flex: "1 1 140px", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", borderTop: `3px solid ${COLORS[i % COLORS.length]}` }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{t.type}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS[i % COLORS.length] }}>{t.count}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{t.qty.toLocaleString()} units</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Table */}
      {data.lowStockItems.length > 0 && (
        <div className="panel">
          <div className="panel-head">Low Stock Alert</div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Item Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>Current Stock</th><th>Min Stock</th><th>UOM</th></tr></thead>
              <tbody>
                {data.lowStockItems.map((i) => (
                  <tr key={i.id} style={{ background: i.currentStock === 0 ? "var(--red-bg)" : "#f59e0b10" }}>
                    <td><code style={{ fontSize: 11 }}>{i.itemCode}</code></td>
                    <td style={{ fontWeight: 500 }}>{i.name}</td>
                    <td style={{ fontSize: 12 }}>{i.category}</td>
                    <td style={{ fontSize: 12 }}>{i.warehouseCode}</td>
                    <td style={{ fontWeight: 700, color: i.currentStock === 0 ? "#ef4444" : "#f59e0b" }}>{i.currentStock}</td>
                    <td style={{ fontSize: 12 }}>{i.minStock}</td>
                    <td style={{ fontSize: 12 }}>{i.unitOfMeasure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
