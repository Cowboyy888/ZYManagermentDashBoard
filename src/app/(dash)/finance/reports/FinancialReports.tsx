"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface InvoiceRow {
  id: number; invoiceNumber: string; customerName: string; customerCode: string;
  invoiceDate: string; dueDate: string; status: string;
  totalUsd: number; paidUsd: number; outstanding: number;
}

interface BillRow {
  id: number; billNumber: string; supplierName: string; supplierCode: string;
  billDate: string; dueDate: string; status: string;
  totalUsd: number; paidUsd: number; outstanding: number;
}

interface ExpenseRow {
  id: number; expenseNumber: string; categoryName: string; categoryType: string;
  description: string; amountUsd: number; expenseDate: string; status: string;
}

interface PayrollRow {
  id: number; periodLabel: string; grossUsd: number; netUsd: number; createdAt: string;
}

interface AgingBucket { current: number; days30: number; days60: number; days90: number; over90: number }

interface Props {
  invoices: InvoiceRow[];
  bills: BillRow[];
  expenses: ExpenseRow[];
  payrollRuns: PayrollRow[];
  arAging: AgingBucket;
  apAging: AgingBucket;
  canExport: boolean;
}

type Tab = "pl" | "cashflow" | "ar_aging" | "ap_aging" | "expenses";

const TAB_LABELS: Record<Tab, string> = {
  pl: "P&L Statement",
  cashflow: "Cash Flow",
  ar_aging: "AR Aging",
  ap_aging: "AP Aging",
  expenses: "Expense Breakdown",
};

const AGING_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444", "#7f1d1d"];

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtUsd2(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function getMonth(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FinancialReports({ invoices, bills, expenses, payrollRuns, arAging, apAging, canExport: _canExport }: Props) {
  const [tab, setTab] = useState<Tab>("pl");

  // P&L: monthly revenue and expenses
  const plData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; billExpenses: number; opExpenses: number; payroll: number }> = {};
    const addMonth = (k: string) => {
      if (!months[k]) months[k] = { month: new Date(k + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }), revenue: 0, billExpenses: 0, opExpenses: 0, payroll: 0 };
    };
    for (const inv of invoices) {
      if (inv.status === "DRAFT") continue;
      const k = getMonth(inv.invoiceDate); addMonth(k);
      months[k].revenue += inv.totalUsd;
    }
    for (const b of bills) {
      if (b.status === "VOID") continue;
      const k = getMonth(b.billDate); addMonth(k);
      months[k].billExpenses += b.totalUsd;
    }
    for (const e of expenses) {
      const k = getMonth(e.expenseDate); addMonth(k);
      months[k].opExpenses += e.amountUsd;
    }
    for (const p of payrollRuns) {
      const k = getMonth(p.createdAt); addMonth(k);
      months[k].payroll += p.grossUsd;
    }
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => ({
      ...v,
      totalExpenses: v.billExpenses + v.opExpenses + v.payroll,
      profit: v.revenue - v.billExpenses - v.opExpenses - v.payroll,
    }));
  }, [invoices, bills, expenses, payrollRuns]);

  const totalRevenue = plData.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = plData.reduce((s, m) => s + m.totalExpenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Expense breakdown by category type
  const expenseByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.categoryType] = (map[e.categoryType] ?? 0) + e.amountUsd;
    }
    for (const p of payrollRuns) {
      map["PAYROLL"] = (map["PAYROLL"] ?? 0) + p.grossUsd;
    }
    for (const b of bills) {
      if (b.status !== "VOID") map["SUPPLIER BILLS"] = (map["SUPPLIER BILLS"] ?? 0) + b.totalUsd;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses, payrollRuns, bills]);

  // AR aging data
  const arAgingData = [
    { name: "Current", value: arAging.current },
    { name: "1-30 days", value: arAging.days30 },
    { name: "31-60 days", value: arAging.days60 },
    { name: "61-90 days", value: arAging.days90 },
    { name: "90+ days", value: arAging.over90 },
  ].filter((d) => d.value > 0);

  const apAgingData = [
    { name: "Current", value: apAging.current },
    { name: "1-30 days", value: apAging.days30 },
    { name: "31-60 days", value: apAging.days60 },
    { name: "61-90 days", value: apAging.days90 },
    { name: "90+ days", value: apAging.over90 },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} className="btn" onClick={() => setTab(t)} style={{
            borderRadius: 0, borderBottom: tab === t ? "2px solid var(--primary)" : "none",
            fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--primary)" : "var(--text-2)",
            background: "transparent", fontSize: 13,
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* P&L Statement */}
      {tab === "pl" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
              <div className="kpi-label">Total Revenue (6mo)</div>
              <div className="kpi-value" style={{ color: "#10b981" }}>{fmtUsd(totalRevenue)}</div>
            </div>
            <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
              <div className="kpi-label">Total Expenses (6mo)</div>
              <div className="kpi-value" style={{ color: "#ef4444" }}>{fmtUsd(totalExpenses)}</div>
            </div>
            <div className="kpi-card" style={{ borderTop: `3px solid ${totalProfit >= 0 ? "#10b981" : "#ef4444"}` }}>
              <div className="kpi-label">Net Profit</div>
              <div className="kpi-value" style={{ color: totalProfit >= 0 ? "#10b981" : "#ef4444" }}>{fmtUsd(totalProfit)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Profit Margin</div>
              <div className="kpi-value" style={{ color: profitMargin >= 20 ? "#10b981" : profitMargin >= 0 ? "#f59e0b" : "#ef4444" }}>
                {profitMargin.toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Monthly Revenue vs Expenses (6 months)</div>
            <div className="panel-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v)]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="totalExpenses" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Profit Trend</div>
            <div className="panel-body">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v), "Net Profit"]} />
                  <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Monthly P&L Detail</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                    <th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Op. Expenses</th>
                    <th style={{ textAlign: "right" }}>Payroll</th>
                    <th style={{ textAlign: "right" }}>Total Expenses</th>
                    <th style={{ textAlign: "right" }}>Net Profit</th>
                    <th style={{ textAlign: "right" }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {plData.map((m) => {
                    const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
                    return (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 600 }}>{m.month}</td>
                        <td style={{ textAlign: "right", color: "#10b981", fontWeight: 600 }}>{fmtUsd(m.revenue)}</td>
                        <td style={{ textAlign: "right", fontSize: 12 }}>{fmtUsd(m.billExpenses)}</td>
                        <td style={{ textAlign: "right", fontSize: 12 }}>{fmtUsd(m.opExpenses)}</td>
                        <td style={{ textAlign: "right", fontSize: 12 }}>{fmtUsd(m.payroll)}</td>
                        <td style={{ textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{fmtUsd(m.totalExpenses)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: m.profit >= 0 ? "#10b981" : "#ef4444" }}>{fmtUsd(m.profit)}</td>
                        <td style={{ textAlign: "right", fontSize: 12, color: margin >= 20 ? "#10b981" : margin >= 0 ? "#f59e0b" : "#ef4444" }}>{margin.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {tab === "cashflow" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head">Monthly Cash Flow</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={plData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v)]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Cash In" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="totalExpenses" name="Cash Out" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Expense Composition</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={expenseByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {expenseByType.map((_, i) => <Cell key={i} fill={["#ef4444", "#f97316", "#f59e0b", "#6366f1", "#10b981", "#a855f7"][i % 6]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v)]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AR Aging */}
      {tab === "ar_aging" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              ["Current", arAging.current],
              ["1-30 Days", arAging.days30],
              ["31-60 Days", arAging.days60],
              ["61-90 Days", arAging.days90],
              ["90+ Days", arAging.over90],
            ].map(([label, val], i) => (
              <div key={String(label)} className="kpi-card" style={{ borderTop: `3px solid ${AGING_COLORS[i]}` }}>
                <div className="kpi-label">{label}</div>
                <div className="kpi-value" style={{ color: AGING_COLORS[i], fontSize: 16 }}>{fmtUsd(Number(val))}</div>
              </div>
            ))}
          </div>
          {arAgingData.length > 0 && (
            <div className="panel">
              <div className="panel-head">AR Aging Breakdown</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={arAgingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v), "Outstanding"]} />
                    <Bar dataKey="value" name="Outstanding">
                      {arAgingData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel-head">Outstanding Invoices</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Invoice Date</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                    <th>Total</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.filter((i) => i.outstanding > 0 && i.status !== "VOID").length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "#10b981", padding: 20 }}>No outstanding receivables</td></tr>
                  ) : invoices.filter((i) => i.outstanding > 0 && i.status !== "VOID").map((i) => {
                    const daysOver = Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000));
                    return (
                      <tr key={i.id} style={{ background: daysOver > 90 ? "var(--red-bg)" : undefined }}>
                        <td><code style={{ fontSize: 11 }}>{i.invoiceNumber}</code></td>
                        <td style={{ fontSize: 12 }}>{i.customerName}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(i.invoiceDate)}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(i.dueDate)}</td>
                        <td style={{ fontSize: 12, color: daysOver > 0 ? "#ef4444" : "#10b981", fontWeight: daysOver > 0 ? 600 : 400 }}>
                          {daysOver > 0 ? `${daysOver}d` : "On time"}
                        </td>
                        <td style={{ fontSize: 12 }}>{fmtUsd2(i.totalUsd)}</td>
                        <td style={{ fontWeight: 700, color: "#f97316" }}>{fmtUsd2(i.outstanding)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AP Aging */}
      {tab === "ap_aging" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              ["Current", apAging.current],
              ["1-30 Days", apAging.days30],
              ["31-60 Days", apAging.days60],
              ["61-90 Days", apAging.days90],
              ["90+ Days", apAging.over90],
            ].map(([label, val], i) => (
              <div key={String(label)} className="kpi-card" style={{ borderTop: `3px solid ${AGING_COLORS[i]}` }}>
                <div className="kpi-label">{label}</div>
                <div className="kpi-value" style={{ color: AGING_COLORS[i], fontSize: 16 }}>{fmtUsd(Number(val))}</div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head">Outstanding Bills</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Supplier</th>
                    <th>Bill Date</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                    <th>Total</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.filter((b) => b.outstanding > 0 && b.status !== "VOID").length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "#10b981", padding: 20 }}>No outstanding payables</td></tr>
                  ) : bills.filter((b) => b.outstanding > 0 && b.status !== "VOID").map((b) => {
                    const daysOver = Math.max(0, Math.floor((Date.now() - new Date(b.dueDate).getTime()) / 86400000));
                    return (
                      <tr key={b.id} style={{ background: daysOver > 90 ? "var(--red-bg)" : undefined }}>
                        <td><code style={{ fontSize: 11 }}>{b.billNumber}</code></td>
                        <td style={{ fontSize: 12 }}>{b.supplierName}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(b.billDate)}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(b.dueDate)}</td>
                        <td style={{ fontSize: 12, color: daysOver > 0 ? "#ef4444" : "#10b981", fontWeight: daysOver > 0 ? 600 : 400 }}>
                          {daysOver > 0 ? `${daysOver}d` : "On time"}
                        </td>
                        <td style={{ fontSize: 12 }}>{fmtUsd2(b.totalUsd)}</td>
                        <td style={{ fontWeight: 700, color: "#f97316" }}>{fmtUsd2(b.outstanding)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expense Breakdown */}
      {tab === "expenses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head">Expenses by Category Type</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={expenseByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {expenseByType.map((_, i) => <Cell key={i} fill={["#ef4444", "#f97316", "#f59e0b", "#6366f1", "#10b981", "#a855f7"][i % 6]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v)]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Monthly Expense Trend</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={plData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtUsd(v)]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="billExpenses" name="Supplier Bills" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="opExpenses" name="Operational" fill="#f97316" radius={[0, 0, 0, 0]} stackId="a" />
                    <Bar dataKey="payroll" name="Payroll" fill="#6366f1" radius={[2, 2, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Expense Detail</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Expense #</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 100).map((e) => (
                    <tr key={e.id}>
                      <td><code style={{ fontSize: 11 }}>{e.expenseNumber}</code></td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</td>
                      <td style={{ fontSize: 12 }}>{e.categoryName}</td>
                      <td style={{ fontSize: 11 }}>{e.categoryType}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUsd2(e.amountUsd)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(e.expenseDate)}</td>
                      <td style={{ fontSize: 11 }}>{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
