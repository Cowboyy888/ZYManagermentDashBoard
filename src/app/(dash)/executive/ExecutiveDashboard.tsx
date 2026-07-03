"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, Legend,
} from "recharts";
import { ExportMenu } from "@/components/ExportMenu";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DeptStat {
  id: number; name: string; count: number;
  attendancePct: number | null; leaveCount: number;
  otHours: number; otCostUsd: number;
}

interface Props {
  canExport: boolean;
  headcount: number;
  terminatedCount: number;
  positionCount: number;
  presentToday: number;
  leaveToday: number;
  absentToday: number;
  attendanceRateToday: number | null;
  monthlyAttendanceRate: number | null;
  contractExpiring7: number;
  contractExpiring30: number;
  birthdaysThisMonth: { id: number; nameEn: string; nameKh: string; birthday: string }[];
  pendingLeaveCount: number;
  onLeaveTodayCount: number;
  leaveByType: { type: string; count: number }[];
  leaveByStatus: { status: string; count: number }[];
  attendanceTrend: { date: string; present: number; total: number; rate: number }[];
  departments: DeptStat[];
  latestPeriod: {
    label: string; locked: boolean;
    grossUsd: number | null; count: number; finalizedCount: number;
    payrollDate: string | null; periodEndDate: string;
  } | null;
  payrollTrend: { label: string; grossUsd: number; netUsd: number; count: number; locked: boolean }[];
  otByBand: { band: string; hours: number; amountUsd: number }[];
  otThisMonthUsd: number;
  // Production
  prodMonthlyKg: number | null;
  prodDowntimeMin: number | null;
  machineUtilPct: number | null;
  ordersInProgress: number;
  ordersCompleted: number;
  qcPassRate: number | null;
  machinesByStatus: { status: string; count: number }[];
  // Inventory
  invTotalValueUsd: number | null;
  invTotalItems: number | null;
  invLowStockCount: number | null;
  invOutOfStockCount: number | null;
  // Purchasing
  purchPendingApproval: number | null;
  purchAwaitingReceipt: number | null;
  purchMonthlySpendUsd: number | null;
  purchLowStockCount: number | null;
  // Sales
  salesRevenueThisMonth: number | null;
  salesActiveOrders: number | null;
  salesPendingQuotations: number | null;
  salesOutstandingDeliveries: number | null;
  // Quality
  qmsPassRate: number | null;
  qmsOpenNCRs: number | null;
  qmsOverdueCAPAs: number | null;
  qmsCertificatesThisMonth: number | null;
  // Maintenance (CMMS)
  cmmsAvailability: number | null;
  cmmsOpenWOs: number | null;
  cmmsDueThisWeek: number | null;
  cmmsMonthlyCostUsd: number | null;
  // Finance & Accounting
  financeRevenue: number | null;
  financeExpenses: number | null;
  financeProfit: number | null;
  financeCashBalance: number | null;
  financeArBalance: number | null;
  financeApBalance: number | null;
  // Hiring + activity
  hiringByMonth: { month: string; count: number }[];
  recentHires: { id: number; nameEn: string; nameKh: string; departmentName: string | null; hireDate: string }[];
  recentLeave: { id: string; nameEn: string; type: string; status: string; startDate: string; endDate: string }[];
  recentPayrollRuns: { id: string; periodLabel: string; createdBy: string; grossUsd: number; count: number; createdAt: string }[];
}

// ─── Formatters ────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const fmtDateFull = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const BAND_LABELS: Record<string, string> = {
  NORMAL_1_5: "Normal (1.5×)",
  NIGHT_2_0:  "Night (2.0×)",
  HOLIDAY_2_0:"Holiday (2.0×)",
};

const TYPE_COLORS: Record<string, string> = {
  ANNUAL:    "#2d4a63",
  SICK:      "#1d9e75",
  SPECIAL:   "#3c3489",
  UNPAID:    "#a32d2d",
  PERMITTED: "#854f0b",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "#854f0b",
  APPROVED: "#0f6e56",
  REJECTED: "#a32d2d",
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub?: string;
  accent?: "steel" | "green" | "amber" | "red" | "purple" | "blue";
  icon?: React.ReactNode;
}) {
  const c: Record<string, string> = {
    steel:  "var(--steel)",  green:  "var(--green)",
    amber:  "var(--amber)",  red:    "var(--red)",
    purple: "var(--purple)", blue:   "var(--blue)",
  };
  const bg: Record<string, string> = {
    steel:  "var(--steel-light)", green:  "var(--green-bg)",
    amber:  "var(--amber-bg)",    red:    "var(--red-bg)",
    purple: "var(--purple-bg)",   blue:   "var(--blue-bg)",
  };
  const color = c[accent ?? "steel"];
  const bgColor = bg[accent ?? "steel"];
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </p>
        {icon && (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 14 }}>
            {icon}
          </div>
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: "var(--text-3)" }}>{sub}</p>}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function Section({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
      {action}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────

const ChartTooltip = { contentStyle: { border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--surface)", color: "var(--text)" } };

// ─── Root component ────────────────────────────────────────────────────────────

export function ExecutiveDashboard({
  canExport,
  headcount, terminatedCount, positionCount,
  presentToday, leaveToday, absentToday,
  attendanceRateToday, monthlyAttendanceRate,
  contractExpiring7, contractExpiring30,
  birthdaysThisMonth,
  pendingLeaveCount, onLeaveTodayCount,
  leaveByType, leaveByStatus,
  attendanceTrend,
  departments,
  latestPeriod, payrollTrend,
  otByBand, otThisMonthUsd,
  prodMonthlyKg, prodDowntimeMin, machineUtilPct,
  ordersInProgress, ordersCompleted, qcPassRate,
  machinesByStatus,
  invTotalValueUsd, invTotalItems, invLowStockCount, invOutOfStockCount,
  purchPendingApproval, purchAwaitingReceipt, purchMonthlySpendUsd, purchLowStockCount,
  salesRevenueThisMonth, salesActiveOrders, salesPendingQuotations, salesOutstandingDeliveries,
  qmsPassRate, qmsOpenNCRs, qmsOverdueCAPAs, qmsCertificatesThisMonth,
  cmmsAvailability, cmmsOpenWOs, cmmsDueThisWeek, cmmsMonthlyCostUsd,
  financeRevenue, financeExpenses, financeProfit, financeCashBalance, financeArBalance, financeApBalance,
  hiringByMonth,
  recentHires, recentLeave, recentPayrollRuns,
}: Props) {
  const today = new Date();

  // ─── Dark mode ───────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  const toggleDark = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  }, [dark]);

  // ─── Dept table sort ─────────────────────────────────────────────────────────
  const [deptSort, setDeptSort] = useState<keyof DeptStat>("name");
  const [deptDir,  setDeptDir]  = useState<"asc" | "desc">("asc");
  const [deptFilter, setDeptFilter] = useState("");

  function sortDept(col: keyof DeptStat) {
    if (deptSort === col) setDeptDir((d) => d === "asc" ? "desc" : "asc");
    else { setDeptSort(col); setDeptDir(col === "name" ? "asc" : "desc"); }
  }

  const sortedDepts = useMemo(() => {
    let list = [...departments];
    if (deptFilter) list = list.filter((d) => d.name.toLowerCase().includes(deptFilter.toLowerCase()));
    list.sort((a, b) => {
      const av = a[deptSort] ?? 0;
      const bv = b[deptSort] ?? 0;
      if (av === bv) return 0;
      const cmp = typeof av === "string"
        ? (av as string).localeCompare(bv as string)
        : (av as number) - (bv as number);
      return deptDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [departments, deptSort, deptDir, deptFilter]);

  const SortArrow = ({ col }: { col: keyof DeptStat }) =>
    deptSort === col ? (deptDir === "asc" ? " ↑" : " ↓") : "";

  // ─── KPI export data ─────────────────────────────────────────────────────────
  const kpiExportData = [
    { metric: "Total Employees (Active)", value: headcount },
    { metric: "Present Today", value: presentToday },
    { metric: "On Leave Today", value: onLeaveTodayCount },
    { metric: "Absent Today", value: absentToday },
    { metric: "Attendance Rate (Today %)", value: attendanceRateToday ?? "N/A" },
    { metric: "Attendance Rate (Monthly %)", value: monthlyAttendanceRate ?? "N/A" },
    { metric: "Total Departments", value: departments.length },
    { metric: "Total Positions", value: positionCount },
    { metric: "Terminated Employees", value: terminatedCount },
    { metric: "Pending Leave Requests", value: pendingLeaveCount },
    { metric: "Contracts Expiring (7d)", value: contractExpiring7 },
    { metric: "Contracts Expiring (30d)", value: contractExpiring30 },
    { metric: "OT Cost This Month (USD)", value: otThisMonthUsd },
    { metric: "Current Period", value: latestPeriod?.label ?? "N/A" },
    { metric: "Current Payroll Gross (USD)", value: latestPeriod?.grossUsd ?? "N/A" },
    { metric: "Employees Paid (Finalized)", value: latestPeriod?.finalizedCount ?? 0 },
  ];
  const kpiExportCols = [
    { header: "Metric", key: "metric", width: 36 },
    { header: "Value", key: "value", width: 20 },
  ];

  const deptExportData = sortedDepts.map((d) => ({
    department: d.name,
    employees: d.count,
    attendancePct: d.attendancePct !== null ? `${d.attendancePct}%` : "N/A",
    leaveThisMonth: d.leaveCount,
    otHours: d.otHours,
    otCostUsd: d.otCostUsd,
  }));
  const deptExportCols = [
    { header: "Department", key: "department", width: 24 },
    { header: "Employees", key: "employees", width: 12 },
    { header: "Attendance %", key: "attendancePct", width: 14 },
    { header: "Leave (Month)", key: "leaveThisMonth", width: 14 },
    { header: "OT Hours", key: "otHours", width: 12 },
    { header: "OT Cost (USD)", key: "otCostUsd", width: 14 },
  ];

  // ─── Alerts ───────────────────────────────────────────────────────────────────
  const alerts: { text: string; accent: "red" | "amber" }[] = [];
  if (contractExpiring7 > 0) alerts.push({ text: `${contractExpiring7} contract${contractExpiring7 > 1 ? "s" : ""} expiring within 7 days`, accent: "red" });
  if (contractExpiring30 > 0) alerts.push({ text: `${contractExpiring30 - contractExpiring7} additional contract${contractExpiring30 - contractExpiring7 !== 1 ? "s" : ""} expiring in 30 days`, accent: "amber" });
  if (pendingLeaveCount > 0) alerts.push({ text: `${pendingLeaveCount} leave request${pendingLeaveCount > 1 ? "s" : ""} awaiting approval`, accent: "amber" });
  if (latestPeriod && !latestPeriod.locked && latestPeriod.count === 0) alerts.push({ text: `Payroll not yet run for ${latestPeriod.label}`, accent: "amber" });

  const filteredAlerts = alerts.filter((a) => !(a.accent === "amber" && (contractExpiring30 - contractExpiring7 <= 0) && a.text.includes("additional")));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0 }}>Executive Analytics</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text-2)", fontSize: 12.5,
              cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {dark ? "☀ Light" : "◑ Dark"}
          </button>
          {/* Print */}
          <button
            onClick={() => window.print()}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text-2)", fontSize: 12.5,
              cursor: "pointer", fontWeight: 500,
            }}
          >
            ⎙ Print
          </button>
          {/* Export */}
          {canExport && (
            <ExportMenu
              data={kpiExportData}
              columns={kpiExportCols}
              filename="executive-kpi-summary"
              title="Executive KPI Summary"
              subtitle={`ZY Steel HR Dashboard · ${today.toLocaleDateString("en-GB")}`}
            />
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {alerts.filter((a) => !(a.text.includes("additional") && contractExpiring30 - contractExpiring7 <= 0)).map((a, i) => (
        <div key={i} style={{
          padding: "11px 16px", borderRadius: 8,
          background: `var(--${a.accent}-bg)`, color: `var(--${a.accent})`,
          fontSize: 13, fontWeight: 500,
          borderLeft: `4px solid var(--${a.accent})`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {a.accent === "red" ? "🚨" : "⚠️"} {a.text}
        </div>
      ))}

      {/* ── Birthdays this month ── */}
      {birthdaysThisMonth.length > 0 && (
        <div style={{
          padding: "11px 16px", borderRadius: 8,
          background: "var(--purple-bg)", color: "var(--purple)",
          fontSize: 13, fontWeight: 500,
          borderLeft: "4px solid var(--purple)",
        }}>
          🎂 Birthdays this month: {birthdaysThisMonth.map((e) => `${e.nameEn} (${fmtDate(e.birthday)})`).join("  ·  ")}
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div>
        <Section title="Key Performance Indicators" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
          <Kpi label="Total Employees" value={headcount} sub="Active" accent="steel"
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />

          <Kpi label="Present Today" value={presentToday || "—"}
            sub={attendanceRateToday !== null ? `${attendanceRateToday}% today` : "No data"}
            accent={attendanceRateToday !== null ? (attendanceRateToday >= 90 ? "green" : attendanceRateToday >= 75 ? "amber" : "red") : "steel"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>} />

          <Kpi label="On Leave Today" value={onLeaveTodayCount}
            sub="Approved leave"
            accent={onLeaveTodayCount > 0 ? "amber" : "steel"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />

          <Kpi label="Absent Today" value={absentToday}
            sub="Unplanned absence"
            accent={absentToday > 0 ? "red" : "steel"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>} />

          <Kpi label="Monthly Rate"
            value={monthlyAttendanceRate !== null ? `${monthlyAttendanceRate}%` : "—"}
            sub="Attendance this month"
            accent={monthlyAttendanceRate === null ? "steel" : monthlyAttendanceRate >= 90 ? "green" : monthlyAttendanceRate >= 75 ? "amber" : "red"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />

          <Kpi label="Departments" value={departments.length} sub={`${departments.filter(d => d.count > 0).length} active`} accent="steel"
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>} />

          <Kpi label="Positions" value={positionCount} sub="Active roles" accent="steel"
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>} />

          <Kpi label="Pending Leave" value={pendingLeaveCount}
            sub="Awaiting approval"
            accent={pendingLeaveCount > 0 ? "amber" : "steel"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>} />

          <Kpi label="Contracts Expiring" value={contractExpiring30}
            sub="Next 30 days"
            accent={contractExpiring7 > 0 ? "red" : contractExpiring30 > 0 ? "amber" : "steel"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />

          <Kpi label="OT This Month" value={fmtUsd(otThisMonthUsd)}
            sub="Overtime cost (USD)"
            accent={otThisMonthUsd > 0 ? "blue" : "steel"}
            icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>} />

          {latestPeriod && (
            <>
              <Kpi label="Payroll Period" value={latestPeriod.label}
                sub={latestPeriod.locked ? "Closed ✓" : "Open"}
                accent={latestPeriod.locked ? "green" : "amber"}
                icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>} />

              <Kpi label="Payroll Gross"
                value={latestPeriod.grossUsd != null ? fmtUsd(latestPeriod.grossUsd) : "—"}
                sub={latestPeriod.finalizedCount > 0 ? `${latestPeriod.finalizedCount} finalized` : latestPeriod.count > 0 ? `${latestPeriod.count} draft` : "Not run"}
                accent={latestPeriod.finalizedCount > 0 ? "green" : latestPeriod.count > 0 ? "amber" : "steel"}
                icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
            </>
          )}
        </div>
      </div>

      {/* ── Workforce Analytics ── */}
      <div>
        <Section title="Workforce Analytics" />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          {/* Attendance trend */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Attendance Rate — This Month</p>
            {attendanceTrend.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>No attendance data this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={attendanceTrend} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => fmtDate(v)} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...ChartTooltip} formatter={(v) => [`${v}%`, "Attendance"]}
                    labelFormatter={(l) => fmtDate(l)} />
                  <Line type="monotone" dataKey="rate" stroke="var(--steel)" strokeWidth={2} dot={{ r: 3, fill: "var(--steel)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Leave by type */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Leave by Type (YTD)</p>
            {leaveByType.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>No leave requests this year.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={leaveByType} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={68} />
                  <Tooltip {...ChartTooltip} />
                  <Bar dataKey="count" name="Requests" radius={[0, 4, 4, 0]}>
                    {leaveByType.map((entry) => (
                      <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "var(--steel)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </div>

      {/* ── Financial Overview ── */}
      <div>
        <Section title="Financial Overview" />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          {/* Payroll trend */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Payroll Cost — Last 6 Periods</p>
            {payrollTrend.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>No payroll data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={payrollTrend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...ChartTooltip} formatter={(v: number) => [fmtUsd(v)]} />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="grossUsd" name="Gross USD" fill="var(--steel)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netUsd"   name="Net USD"   fill="var(--green)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* OT by band */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Overtime by Band (Last 30d)</p>
            {otByBand.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>No overtime in the last 30 days.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {otByBand.map((b) => (
                  <div key={b.band}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-2)" }}>{BAND_LABELS[b.band] ?? b.band}</span>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmtUsd(b.amountUsd)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--surface-2)" }}>
                        <div style={{
                          height: 6, borderRadius: 4, background: "var(--blue)",
                          width: `${Math.min((b.hours / Math.max(...otByBand.map(x => x.hours))) * 100, 100)}%`,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-3)", minWidth: 40, textAlign: "right" }}>{b.hours.toFixed(1)}h</span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-3)" }}>Total</span>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmtUsd(otThisMonthUsd)}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Hiring Trend ── */}
      <div>
        <Section title="Employee Growth" />
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>New Hires — Last 6 Months</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hiringByMonth} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...ChartTooltip} />
              <Bar dataKey="count" name="New hires" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Department Performance ── */}
      <div>
        <Section
          title="Department Performance"
          action={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Filter…"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12.5, background: "var(--surface)", color: "var(--text)", width: 140 }}
              />
              {canExport && sortedDepts.length > 0 && (
                <ExportMenu
                  data={deptExportData}
                  columns={deptExportCols}
                  filename="department-performance"
                  title="Department Performance"
                  subtitle={`ZY Steel · ${today.toLocaleDateString("en-GB")}`}
                />
              )}
            </div>
          }
        />
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                {([
                  ["name",       "Department"],
                  ["count",      "Employees"],
                  ["attendancePct", "Attendance %"],
                  ["leaveCount",    "Leave (Month)"],
                  ["otHours",       "OT Hours"],
                  ["otCostUsd",     "OT Cost"],
                ] as [keyof DeptStat, string][]).map(([col, label]) => (
                  <th key={col}
                    onClick={() => sortDept(col)}
                    style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", textAlign: col === "name" ? "left" : "right" }}>
                    {label}<SortArrow col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDepts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: "32px 0" }}>No departments match.</td></tr>
              ) : sortedDepts.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td style={{ textAlign: "right" }}>{d.count}</td>
                  <td style={{ textAlign: "right" }}>
                    {d.attendancePct !== null ? (
                      <span style={{ color: d.attendancePct >= 90 ? "var(--green)" : d.attendancePct >= 75 ? "var(--amber)" : "var(--red)", fontWeight: 600 }}>
                        {d.attendancePct}%
                      </span>
                    ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right", color: d.leaveCount > 0 ? "var(--amber)" : "var(--text-3)" }}>
                    {d.leaveCount > 0 ? d.leaveCount : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{d.otHours > 0 ? d.otHours.toFixed(1) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{d.otCostUsd > 0 ? fmtUsd(d.otCostUsd) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div>
        <Section title="Recent Activity" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {/* Recent hires */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>New Hires</p>
            </div>
            {recentHires.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>No recent hires.</p>
            ) : (
              <div>
                {recentHires.slice(0, 6).map((e) => (
                  <div key={e.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 18px", borderBottom: "1px solid var(--border)",
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--steel-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--steel)", flexShrink: 0 }}>
                      {e.nameEn.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nameEn}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {e.departmentName ?? "—"} · {fmtDate(e.hireDate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent leave */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Leave Requests</p>
            </div>
            {recentLeave.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>No recent leave.</p>
            ) : (
              <div>
                {recentLeave.slice(0, 6).map((l) => (
                  <div key={l.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "10px 18px", borderBottom: "1px solid var(--border)",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nameEn}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {l.type.charAt(0) + l.type.slice(1).toLowerCase()} · {fmtDate(l.startDate)}
                        {l.startDate !== l.endDate ? ` – ${fmtDate(l.endDate)}` : ""}
                      </div>
                    </div>
                    <span className="tag" style={{
                      color: STATUS_COLORS[l.status] ?? "var(--text-3)",
                      background: l.status === "APPROVED" ? "var(--green-bg)" : l.status === "REJECTED" ? "var(--red-bg)" : "var(--amber-bg)",
                      flexShrink: 0,
                    }}>
                      {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent payroll runs */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Payroll Runs</p>
            </div>
            {recentPayrollRuns.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>No payroll runs yet.</p>
            ) : (
              <div>
                {recentPayrollRuns.slice(0, 5).map((r) => (
                  <div key={r.id} style={{
                    padding: "10px 18px", borderBottom: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{r.periodLabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--steel)" }}>{fmtUsd(r.grossUsd)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      {r.count} payslips · {r.createdBy} · {fmtDate(r.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Leave breakdown ── */}
      <div>
        <Section title="Leave Overview (YTD)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* By status */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>By Status</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leaveByStatus.map((s) => {
                const total = leaveByStatus.reduce((a, x) => a + x.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.status}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-2)", fontWeight: 500 }}>
                        {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{s.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)" }}>
                      <div style={{
                        height: 6, borderRadius: 4,
                        background: STATUS_COLORS[s.status] ?? "var(--steel)",
                        width: `${pct}%`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* By type */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>By Type</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leaveByType.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>No data.</p>
              ) : leaveByType.map((t) => {
                const total = leaveByType.reduce((a, x) => a + x.count, 0);
                const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
                return (
                  <div key={t.type}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-2)", fontWeight: 500 }}>
                        {t.type.charAt(0) + t.type.slice(1).toLowerCase()}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{t.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)" }}>
                      <div style={{
                        height: 6, borderRadius: 4,
                        background: TYPE_COLORS[t.type] ?? "var(--steel)",
                        width: `${pct}%`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Production Section ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Production
          </h2>
          <a href="/production" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open Production →</a>
        </div>

        {/* Production KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Kpi
            label="Monthly Output"
            value={prodMonthlyKg !== null ? `${prodMonthlyKg.toLocaleString()} kg` : "—"}
            sub="mesh produced this month"
            accent="steel"
          />
          <Kpi
            label="Machine Utilization"
            value={machineUtilPct !== null ? `${machineUtilPct}%` : "—"}
            sub="operational machines"
            accent={machineUtilPct !== null ? (machineUtilPct >= 80 ? "green" : machineUtilPct >= 50 ? "amber" : "red") : "steel"}
          />
          <Kpi
            label="Orders In Progress"
            value={ordersInProgress}
            sub="active production orders"
            accent={ordersInProgress > 0 ? "amber" : "steel"}
          />
          <Kpi
            label="Completed Orders"
            value={ordersCompleted}
            sub="all time"
            accent="green"
          />
          <Kpi
            label="QC Pass Rate"
            value={qcPassRate !== null ? `${qcPassRate}%` : "—"}
            sub="last 30 days"
            accent={qcPassRate !== null ? (qcPassRate >= 95 ? "green" : qcPassRate >= 80 ? "amber" : "red") : "steel"}
          />
          <Kpi
            label="Downtime This Month"
            value={prodDowntimeMin !== null ? `${Math.round(prodDowntimeMin / 60)}h ${prodDowntimeMin % 60}m` : "—"}
            sub="total recorded"
            accent={prodDowntimeMin !== null && prodDowntimeMin > 480 ? "red" : "steel"}
          />
        </div>

        {/* Machine status breakdown */}
        {machinesByStatus.length > 0 && (
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Machine Status</p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {machinesByStatus.map((m) => {
                const total = machinesByStatus.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
                const color = m.status === "OPERATIONAL" ? "var(--green)" : m.status === "UNDER_MAINTENANCE" ? "var(--amber)" : "var(--text-3)";
                return (
                  <div key={m.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color }}>{m.count}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color }}>{m.status.replace("_", " ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{pct}%</div>
                    </div>
                    <div style={{ width: 70, height: 6, borderRadius: 3, background: "var(--surface-2)" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ── Inventory Section ───────────────────────────────────────────────────── */}
      {invTotalItems !== null && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Inventory</h2>
            <a href="/inventory" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open Inventory →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
            <Kpi label="Total Items" value={invTotalItems ?? 0} accent="steel" />
            <Kpi label="Inventory Value" value={invTotalValueUsd !== null ? `$${invTotalValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} accent="blue" />
            <Kpi label="Low Stock" value={invLowStockCount ?? 0} accent={(invLowStockCount ?? 0) > 0 ? "amber" : undefined} />
            <Kpi label="Out of Stock" value={invOutOfStockCount ?? 0} accent={(invOutOfStockCount ?? 0) > 0 ? "red" : undefined} />
          </div>
        </div>
      )}

      {/* ── Purchasing Section ──────────────────────────────────────────────────── */}
      {purchPendingApproval !== null && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Purchasing</h2>
            <a href="/purchasing" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open Purchasing →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
            <Kpi label="Pending Approval" value={purchPendingApproval ?? 0} accent={(purchPendingApproval ?? 0) > 0 ? "amber" : undefined} />
            <Kpi label="Awaiting Receipt" value={purchAwaitingReceipt ?? 0} accent={(purchAwaitingReceipt ?? 0) > 0 ? "blue" : undefined} />
            <Kpi label="Monthly Spend" value={purchMonthlySpendUsd !== null ? `$${purchMonthlySpendUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} accent="steel" />
            <Kpi label="Low Stock Items" value={purchLowStockCount ?? 0} accent={(purchLowStockCount ?? 0) > 0 ? "red" : undefined} />
          </div>
        </div>
      )}

      {/* ── Sales & CRM Section ──────────────────────────────────────────────── */}
      {salesRevenueThisMonth !== null && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sales & CRM</h2>
            <a href="/sales" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open Sales →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            <Kpi label="Revenue This Month" value={salesRevenueThisMonth !== null ? `$${salesRevenueThisMonth.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"} accent="green" />
            <Kpi label="Active Orders" value={salesActiveOrders ?? 0} accent={(salesActiveOrders ?? 0) > 0 ? "blue" : undefined} />
            <Kpi label="Pending Quotations" value={salesPendingQuotations ?? 0} accent={(salesPendingQuotations ?? 0) > 0 ? "amber" : undefined} />
            <Kpi label="Outstanding Deliveries" value={salesOutstandingDeliveries ?? 0} accent={(salesOutstandingDeliveries ?? 0) > 0 ? "amber" : undefined} />
          </div>
        </div>
      )}

      {/* ── Quality & QMS Section ────────────────────────────────────────────────── */}
      {qmsPassRate !== null && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Quality Management</h2>
            <a href="/quality" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open QMS →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            <Kpi label="Inspection Pass Rate" value={qmsPassRate !== null ? `${qmsPassRate.toFixed(1)}%` : "—"} accent={qmsPassRate >= 95 ? "green" : qmsPassRate >= 80 ? "amber" : "red"} />
            <Kpi label="Open NCRs" value={qmsOpenNCRs ?? 0} accent={(qmsOpenNCRs ?? 0) > 0 ? "red" : "green"} />
            <Kpi label="Overdue CAPAs" value={qmsOverdueCAPAs ?? 0} accent={(qmsOverdueCAPAs ?? 0) > 0 ? "red" : "green"} />
            <Kpi label="Certificates Issued" value={qmsCertificatesThisMonth ?? 0} sub="this month" accent="blue" />
          </div>
        </div>
      )}

      {/* ── Maintenance (CMMS) Section ───────────────────────────────────────────── */}
      {cmmsAvailability !== null && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Maintenance (CMMS)</h2>
            <a href="/maintenance" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open CMMS →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            <Kpi
              label="Machine Availability"
              value={cmmsAvailability !== null ? `${cmmsAvailability.toFixed(1)}%` : "—"}
              accent={cmmsAvailability >= 85 ? "green" : cmmsAvailability >= 70 ? "amber" : "red"}
            />
            <Kpi
              label="Open Work Orders"
              value={cmmsOpenWOs ?? 0}
              accent={(cmmsOpenWOs ?? 0) > 10 ? "red" : (cmmsOpenWOs ?? 0) > 5 ? "amber" : "green"}
            />
            <Kpi
              label="PM Due This Week"
              value={cmmsDueThisWeek ?? 0}
              accent={(cmmsDueThisWeek ?? 0) > 0 ? "amber" : "green"}
            />
            <Kpi
              label="Monthly Maint. Cost"
              value={cmmsMonthlyCostUsd !== null ? `$${cmmsMonthlyCostUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              sub="this month"
              accent="steel"
            />
          </div>
        </div>
      )}

      {/* ── Finance & Accounting Section ─────────────────────────────────────────── */}
      {financeRevenue !== null && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Finance & Accounting</h2>
            <a href="/finance" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Open Finance →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
            <Kpi
              label="Revenue (This Month)"
              value={financeRevenue !== null ? `$${financeRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              accent="green"
            />
            <Kpi
              label="Expenses (This Month)"
              value={financeExpenses !== null ? `$${financeExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              accent="red"
            />
            <Kpi
              label="Net Profit"
              value={financeProfit !== null ? `$${financeProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              accent={financeProfit !== null && financeProfit >= 0 ? "green" : "red"}
            />
            <Kpi
              label="Cash Balance"
              value={financeCashBalance !== null ? `$${financeCashBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              accent={financeCashBalance !== null && financeCashBalance >= 0 ? "blue" : "red"}
            />
            <Kpi
              label="AR Outstanding"
              value={financeArBalance !== null ? `$${financeArBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              sub="accounts receivable"
              accent={(financeArBalance ?? 0) > 0 ? "amber" : "green"}
            />
            <Kpi
              label="AP Outstanding"
              value={financeApBalance !== null ? `$${financeApBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              sub="accounts payable"
              accent={(financeApBalance ?? 0) > 0 ? "amber" : "green"}
            />
          </div>
        </div>
      )}

      {/* Print media */}
      <style>{`
        @media print {
          aside, nav, button, .no-print { display: none !important; }
          body { background: white; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
