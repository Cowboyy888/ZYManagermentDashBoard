"use client";

import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface RecentInvoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalUsd: number;
  paidUsd: number;
}

interface RecentBill {
  id: number;
  billNumber: string;
  supplierName: string;
  billDate: string;
  dueDate: string;
  status: string;
  totalUsd: number;
  paidUsd: number;
}

interface Summary {
  monthRevenue: number;
  monthExpenses: number;
  monthProfit: number;
  arBalance: number;
  apBalance: number;
  arOverdue: number;
  apOverdue: number;
  cashBalance: number;
  monthlyTrend: { month: string; revenue: number; expenses: number }[];
  recentInvoices: RecentInvoice[];
  recentBills: RecentBill[];
}

interface Props { summary: Summary; canManage: boolean }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", SENT: "#6366f1", PARTIAL: "#f59e0b",
  PAID: "#10b981", OVERDUE: "#ef4444", VOID: "#94a3b8",
  PENDING: "#6366f1",
};

function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FinanceDashboard({ summary }: Props) {
  const profitMargin = summary.monthRevenue > 0
    ? Math.round((summary.monthProfit / summary.monthRevenue) * 100)
    : 0;

  const trendWithProfit = summary.monthlyTrend.map((m) => ({
    ...m,
    profit: m.revenue - m.expenses,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI Row 1 — P&L */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Revenue (This Month)</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{fmtUsd(summary.monthRevenue)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="kpi-label">Expenses (This Month)</div>
          <div className="kpi-value" style={{ color: "#ef4444" }}>{fmtUsd(summary.monthExpenses)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${summary.monthProfit >= 0 ? "#10b981" : "#ef4444"}` }}>
          <div className="kpi-label">Net Profit</div>
          <div className="kpi-value" style={{ color: summary.monthProfit >= 0 ? "#10b981" : "#ef4444" }}>{fmtUsd(summary.monthProfit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Profit Margin</div>
          <div className="kpi-value" style={{ color: profitMargin >= 20 ? "#10b981" : profitMargin >= 0 ? "#f59e0b" : "#ef4444" }}>
            {profitMargin}%
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cash Balance (est.)</div>
          <div className="kpi-value" style={{ color: summary.cashBalance >= 0 ? "#10b981" : "#ef4444" }}>{fmtUsd(summary.cashBalance)}</div>
        </div>
      </div>

      {/* KPI Row 2 — AR / AP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Accounts Receivable</div>
          <div className="kpi-value" style={{ color: "#6366f1" }}>{fmtUsd(summary.arBalance)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Outstanding AR</div>
        </div>
        <div className="kpi-card" style={{ borderTop: summary.arOverdue > 0 ? "3px solid #ef4444" : undefined }}>
          <div className="kpi-label">Overdue Invoices</div>
          <div className="kpi-value" style={{ color: summary.arOverdue > 0 ? "#ef4444" : "var(--text)" }}>{summary.arOverdue}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f97316" }}>
          <div className="kpi-label">Accounts Payable</div>
          <div className="kpi-value" style={{ color: "#f97316" }}>{fmtUsd(summary.apBalance)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Outstanding AP</div>
        </div>
        <div className="kpi-card" style={{ borderTop: summary.apOverdue > 0 ? "3px solid #ef4444" : undefined }}>
          <div className="kpi-label">Overdue Bills</div>
          <div className="kpi-value" style={{ color: summary.apOverdue > 0 ? "#ef4444" : "var(--text)" }}>{summary.apOverdue}</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
        {/* Revenue vs Expenses Trend */}
        <div className="panel">
          <div className="panel-head">Revenue vs Expenses (6 months)</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={summary.monthlyTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit Trend */}
        <div className="panel">
          <div className="panel-head">Profit Trend</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={trendWithProfit} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Profit"]} />
                <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Net Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent activity tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Invoices */}
        <div className="panel">
          <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Recent Invoices (AR)</span>
            <Link href="/finance/invoices" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentInvoices.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", padding: 20 }}>No invoices yet</td></tr>
                ) : summary.recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><code style={{ fontSize: 11 }}>{inv.invoiceNumber}</code></td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customerName}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(inv.dueDate)}</td>
                    <td style={{ fontSize: 12 }}>{fmtUsd(inv.totalUsd)}</td>
                    <td>
                      <span className="tag" style={{ background: (STATUS_COLORS[inv.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[inv.status] ?? "#94a3b8", fontSize: 10 }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Bills */}
        <div className="panel">
          <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Recent Bills (AP)</span>
            <Link href="/finance/bills" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Supplier</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentBills.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", padding: 20 }}>No bills yet</td></tr>
                ) : summary.recentBills.map((bill) => (
                  <tr key={bill.id}>
                    <td><code style={{ fontSize: 11 }}>{bill.billNumber}</code></td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.supplierName}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(bill.dueDate)}</td>
                    <td style={{ fontSize: 12 }}>{fmtUsd(bill.totalUsd)}</td>
                    <td>
                      <span className="tag" style={{ background: (STATUS_COLORS[bill.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[bill.status] ?? "#94a3b8", fontSize: 10 }}>
                        {bill.status}
                      </span>
                    </td>
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
