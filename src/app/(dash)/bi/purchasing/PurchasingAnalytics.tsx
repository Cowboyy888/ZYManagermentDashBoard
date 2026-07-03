"use client";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Data = {
  totalPOs: number; pendingApproval: number; approvedPOs: number; awaitingReceipt: number;
  monthlyPOs: number; monthlySpendUsd: number; supplierCount: number;
  spendTrend: { month: string; amount: number }[];
  topSuppliers: { id: number; name: string; supplierCode: string; orderCount: number; status: string }[];
  posByStatus: { status: string; count: number; totalUsd: number }[];
  lowStockNeedingPurchase: { id: number; itemCode: string; name: string; currentStock: number; minStock: number; unitOfMeasure: string; categoryCode: string; warehouseCode: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", PENDING_APPROVAL: "#f59e0b", APPROVED: "#6366f1",
  PARTIALLY_RECEIVED: "#3b82f6", RECEIVED: "#10b981", CANCELLED: "#ef4444",
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }

export function PurchasingAnalytics({ data }: { data: Data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #f97316" }}>
          <div className="kpi-label">Monthly Spend</div>
          <div className="kpi-value" style={{ fontSize: 18, color: "#f97316" }}>{fmtUsd(data.monthlySpendUsd)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">POs This Month</div>
          <div className="kpi-value">{data.monthlyPOs}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.pendingApproval > 0 ? "#f59e0b" : "#10b981"}` }}>
          <div className="kpi-label">Pending Approval</div>
          <div className="kpi-value" style={{ color: data.pendingApproval > 0 ? "#f59e0b" : "#10b981" }}>{data.pendingApproval}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Awaiting Receipt</div>
          <div className="kpi-value">{data.awaitingReceipt}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Suppliers</div>
          <div className="kpi-value">{data.supplierCount}</div>
        </div>
      </div>

      {/* Spend trend */}
      <div className="panel">
        <div className="panel-head">Monthly Spend Trend (6 Months)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.spendTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v), "Spend"]} />
              <Bar dataKey="amount" name="Spend" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Suppliers + PO status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Top Suppliers by PO Count</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.topSuppliers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="orderCount" name="POs" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">PO Status Breakdown</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.posByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${count}`} labelLine={false}>
                  {data.posByStatus.map((p) => <Cell key={p.status} fill={STATUS_COLORS[p.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low stock needing purchase */}
      {data.lowStockNeedingPurchase.length > 0 && (
        <div className="panel">
          <div className="panel-head">Low Stock Items — Needs Purchasing</div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>Current</th><th>Min</th><th>UOM</th></tr></thead>
              <tbody>
                {data.lowStockNeedingPurchase.map((i) => (
                  <tr key={i.id} style={{ background: i.currentStock === 0 ? "var(--red-bg)" : "#f59e0b10" }}>
                    <td><code style={{ fontSize: 11 }}>{i.itemCode}</code></td>
                    <td style={{ fontWeight: 500 }}>{i.name}</td>
                    <td style={{ fontSize: 12 }}>{i.categoryCode}</td>
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
