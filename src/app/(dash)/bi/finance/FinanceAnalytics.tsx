"use client";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  monthRevenue: number; monthExpenses: number; monthProfit: number;
  arBalance: number; apBalance: number; arOverdue: number; apOverdue: number; cashBalance: number;
  monthlyTrend: { month: string; revenue: number; expenses: number }[];
  recentInvoices: { id: number; invoiceNumber: string; customerName: string; status: string; totalUsd: number; dueDate: string }[];
  recentBills: { id: number; billNumber: string; supplierName: string; status: string; totalUsd: number; dueDate: string }[];
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fmtUsd2(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function FinanceAnalytics({ data }: { data: Data }) {
  const profitMargin = data.monthRevenue > 0 ? Math.round((data.monthProfit / data.monthRevenue) * 100) : 0;

  const plData = data.monthlyTrend.map((m) => ({
    ...m,
    profit: m.revenue - m.expenses,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Revenue (Month)</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{fmtUsd(data.monthRevenue)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="kpi-label">Expenses (Month)</div>
          <div className="kpi-value" style={{ color: "#ef4444" }}>{fmtUsd(data.monthExpenses)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.monthProfit >= 0 ? "#10b981" : "#ef4444"}` }}>
          <div className="kpi-label">Net Profit</div>
          <div className="kpi-value" style={{ color: data.monthProfit >= 0 ? "#10b981" : "#ef4444" }}>{fmtUsd(data.monthProfit)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{profitMargin}% margin</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Cash Balance</div>
          <div className="kpi-value">{fmtUsd(data.cashBalance)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>AR − AP</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.arOverdue > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">AR Outstanding</div>
          <div className="kpi-value">{fmtUsd(data.arBalance)}</div>
          <div style={{ fontSize: 11, color: data.arOverdue > 0 ? "#ef4444" : "var(--text-3)" }}>{data.arOverdue} overdue</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.apOverdue > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">AP Outstanding</div>
          <div className="kpi-value">{fmtUsd(data.apBalance)}</div>
          <div style={{ fontSize: 11, color: data.apOverdue > 0 ? "#ef4444" : "var(--text-3)" }}>{data.apOverdue} overdue</div>
        </div>
      </div>

      {/* P&L Chart */}
      <div className="panel">
        <div className="panel-head">P&L Trend (6 Months)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={plData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Profit Trend */}
      <div className="panel">
        <div className="panel-head">Profit Trend</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={plData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Net Profit"]} />
              <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Invoices + Bills */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Recent Invoices</div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.recentInvoices.slice(0, 6).map((i) => (
                  <tr key={i.id}>
                    <td><code style={{ fontSize: 11 }}>{i.invoiceNumber}</code></td>
                    <td style={{ fontSize: 12 }}>{i.customerName}</td>
                    <td style={{ fontSize: 12 }}>{fmtUsd2(i.totalUsd)}</td>
                    <td><span className="tag" style={{ fontSize: 10 }}>{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">Recent Bills</div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Bill</th><th>Supplier</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.recentBills.slice(0, 6).map((b) => (
                  <tr key={b.id}>
                    <td><code style={{ fontSize: 11 }}>{b.billNumber}</code></td>
                    <td style={{ fontSize: 12 }}>{b.supplierName}</td>
                    <td style={{ fontSize: 12 }}>{fmtUsd2(b.totalUsd)}</td>
                    <td><span className="tag" style={{ fontSize: 10 }}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
