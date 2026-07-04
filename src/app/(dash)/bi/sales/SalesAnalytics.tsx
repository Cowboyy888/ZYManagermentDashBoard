"use client";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  totalCustomers: number; activeLeads: number; pendingQuotations: number;
  activeOrders: number; revenueThisMonth: number; outstandingDeliveries: number;
  revenueTrend: { month: string; amount: number }[];
  topCustomers: { id: number; name: string; customerCode: string; totalUsd: number; orderCount: number }[];
  quotationsByStatus: { status: string; count: number; totalUsd: number }[];
  ordersByStatus: { status: string; count: number; totalUsd: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", SENT: "#6366f1", ACCEPTED: "#10b981", REJECTED: "#ef4444", EXPIRED: "#f59e0b",
  CONFIRMED: "#6366f1", IN_PRODUCTION: "#f59e0b", READY: "#3b82f6", DELIVERED: "#10b981", CANCELLED: "#ef4444",
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }

export function SalesAnalytics({ data }: { data: Data }) {
  const totalQuotationValue = data.quotationsByStatus.reduce((s, q) => s + q.totalUsd, 0);
  const wonValue = data.quotationsByStatus.find((q) => q.status === "ACCEPTED")?.totalUsd ?? 0;
  const conversionRate = totalQuotationValue > 0 ? Math.round((wonValue / totalQuotationValue) * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Revenue (Month)</div>
          <div className="kpi-value">{fmtUsd(data.revenueThisMonth)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Total Customers</div>
          <div className="kpi-value">{data.totalCustomers}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="kpi-label">Active Leads</div>
          <div className="kpi-value">{data.activeLeads}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div className="kpi-label">Active Orders</div>
          <div className="kpi-value">{data.activeOrders}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Quotations</div>
          <div className="kpi-value">{data.pendingQuotations}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${conversionRate !== null && conversionRate >= 50 ? "#10b981" : "#f59e0b"}` }}>
          <div className="kpi-label">Quotation Conversion</div>
          <div className="kpi-value">{conversionRate !== null ? `${conversionRate}%` : "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>by value</div>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="panel">
        <div className="panel-head">Monthly Revenue Trend (6 Months)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Revenue"]} />
              <Bar dataKey="amount" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers + Quotation Funnel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Top Customers by Revenue</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Revenue"]} />
                <Bar dataKey="totalUsd" name="Total Revenue" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Quotation Status Breakdown</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.quotationsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status} (${count})`} labelLine={false}>
                  {data.quotationsByStatus.map((q) => <Cell key={q.status} fill={STATUS_COLORS[q.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Order Pipeline */}
      <div className="panel">
        <div className="panel-head">Order Pipeline by Status</div>
        <div className="panel-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.ordersByStatus.map((o) => (
              <div key={o.status} style={{ flex: "1 1 140px", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", background: (STATUS_COLORS[o.status] ?? "#94a3b8") + "15" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{o.status}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: STATUS_COLORS[o.status] ?? "#94a3b8" }}>{o.count}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{fmtUsd(o.totalUsd)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
