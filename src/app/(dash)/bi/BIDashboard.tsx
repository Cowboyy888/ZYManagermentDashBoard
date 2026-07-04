"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  canManage: boolean;
  revenue: number | null;
  expenses: number | null;
  profit: number | null;
  cashBalance: number | null;
  arBalance: number | null;
  apBalance: number | null;
  headcount: number;
  attendanceRate: number | null;
  presentTodayPct: number | null;
  monthKg: number;
  machineAvailability: number | null;
  productionTrend: { month: string; kg: number }[];
  salesRevenue: number | null;
  activeOrders: number | null;
  inventoryValue: number | null;
  lowStockCount: number | null;
  monthlySpend: number | null;
  qcPassRate: number | null;
  openNCRs: number | null;
  openWOs: number | null;
  alertCounts: { critical: number; warning: number; info: number } | null;
}

function fmtUsd(n: number | null) {
  if (n === null) return "—";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPct(n: number | null) { return n !== null ? `${n}%` : "—"; }

function KpiCard({ label, value, sub, color, href }: { label: string; value: string; sub?: string; color?: string; href?: string }) {
  const card = (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      padding: "16px 18px", borderTop: color ? `3px solid ${color}` : undefined,
      cursor: href ? "pointer" : undefined, textDecoration: "none",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{sub}</div>}
    </div>
  );
  if (href) return <a href={href} style={{ textDecoration: "none" }}>{card}</a>;
  return card;
}

export function BIDashboard(props: Props) {
  const { revenue, expenses, profit, cashBalance, headcount, attendanceRate, monthKg, machineAvailability,
    productionTrend, salesRevenue, inventoryValue, lowStockCount, monthlySpend, qcPassRate, openNCRs, openWOs, alertCounts } = props;

  const profitMargin = revenue && profit !== null ? Math.round((profit / revenue) * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Alert Summary Bar */}
      {alertCounts && (alertCounts.critical + alertCounts.warning + alertCounts.info) > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {alertCounts.critical > 0 && (
            <a href="/bi/alerts" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
              ● {alertCounts.critical} Critical
            </a>
          )}
          {alertCounts.warning > 0 && (
            <a href="/bi/alerts" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#f59e0b20", color: "#d97706", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
              ● {alertCounts.warning} Warning
            </a>
          )}
          {alertCounts.info > 0 && (
            <a href="/bi/alerts" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#6366f120", color: "#6366f1", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
              ● {alertCounts.info} Info
            </a>
          )}
        </div>
      )}

      {/* Primary KPIs */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Financial Performance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <KpiCard label="Revenue (Month)" value={fmtUsd(revenue)} color="#10b981" href="/bi/finance" />
          <KpiCard label="Expenses (Month)" value={fmtUsd(expenses)} color="#ef4444" href="/bi/finance" />
          <KpiCard label="Net Profit" value={fmtUsd(profit)} sub={profitMargin !== null ? `${profitMargin}% margin` : undefined} color={profit !== null && profit >= 0 ? "#10b981" : "#ef4444"} href="/bi/finance" />
          <KpiCard label="Cash Balance" value={fmtUsd(cashBalance)} color="#6366f1" href="/bi/finance" />
          <KpiCard label="Sales Revenue" value={fmtUsd(salesRevenue)} sub="from sales orders" color="#3b82f6" href="/bi/sales" />
          <KpiCard label="Purchase Spend" value={fmtUsd(monthlySpend)} sub="this month" color="#f97316" href="/bi/purchasing" />
        </div>
      </div>

      {/* Operational KPIs */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Operations</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <KpiCard label="Production Output" value={`${monthKg.toLocaleString()} kg`} sub="mesh this month" color="#10b981" href="/bi/production" />
          <KpiCard label="Machine Availability" value={fmtPct(machineAvailability)} color={machineAvailability !== null && machineAvailability >= 85 ? "#10b981" : machineAvailability !== null && machineAvailability >= 70 ? "#f59e0b" : "#ef4444"} href="/bi/maintenance" />
          <KpiCard label="QC Pass Rate" value={fmtPct(qcPassRate)} color={qcPassRate !== null && qcPassRate >= 95 ? "#10b981" : qcPassRate !== null && qcPassRate >= 80 ? "#f59e0b" : "#ef4444"} href="/bi/quality" />
          <KpiCard label="Open NCRs" value={String(openNCRs ?? "—")} color={(openNCRs ?? 0) > 0 ? "#ef4444" : "#10b981"} href="/quality/ncr" />
          <KpiCard label="Open Work Orders" value={String(openWOs ?? "—")} color={(openWOs ?? 0) > 0 ? "#f59e0b" : "#10b981"} href="/maintenance/work-orders" />
          <KpiCard label="Inventory Value" value={fmtUsd(inventoryValue)} sub={lowStockCount ? `${lowStockCount} low stock` : undefined} color="#3b82f6" href="/bi/inventory" />
        </div>
      </div>

      {/* HR KPIs */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Workforce</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <KpiCard label="Total Headcount" value={String(headcount)} sub="active employees" color="#6366f1" href="/bi/hr" />
          <KpiCard label="Attendance (Month)" value={fmtPct(attendanceRate)} color={attendanceRate !== null && attendanceRate >= 90 ? "#10b981" : attendanceRate !== null && attendanceRate >= 75 ? "#f59e0b" : "#ef4444"} href="/bi/hr" />
        </div>
      </div>

      {/* Production Trend Chart */}
      {productionTrend.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>Monthly Production Output (kg)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={productionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}t`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [`${v.toLocaleString()} kg`, "Production"]} />
              <Bar dataKey="kg" name="Production (kg)" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Navigation shortcuts */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Analytics Modules</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {[
            { href: "/bi/hr", label: "HR Analytics", emoji: "👥" },
            { href: "/bi/production", label: "Production", emoji: "🏭" },
            { href: "/bi/sales", label: "Sales & CRM", emoji: "📈" },
            { href: "/bi/finance", label: "Finance", emoji: "💰" },
            { href: "/bi/quality", label: "Quality (QMS)", emoji: "✅" },
            { href: "/bi/maintenance", label: "Maintenance", emoji: "🔧" },
            { href: "/bi/inventory", label: "Inventory", emoji: "📦" },
            { href: "/bi/purchasing", label: "Purchasing", emoji: "🛒" },
            { href: "/bi/forecast", label: "Forecasting", emoji: "🔮" },
            { href: "/bi/alerts", label: "Alerts Center", emoji: "🔔" },
          ].map((item) => (
            <a key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: 8, border: "1px solid var(--border)", textDecoration: "none",
              fontSize: 13, color: "var(--text-2)", fontWeight: 500, background: "transparent",
              transition: "background 0.12s",
            }}>
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
