"use client";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface Props {
  headcount: number;
  presentToday: number;
  leaveToday: number;
  absentToday: number;
  contractExpiring30: number;
  contractExpiring7: number;
  todayBirthdays: { id: number; nameEn: string; nameKh: string }[];
  departments: { id: number; name: string; count: number }[];
  recentOt: {
    id: number; date: string; hours: number; band: string;
    amountUsd: number; description: string | null;
    employee: { nameEn: string; nameKh: string };
  }[];
  hiringByMonth: { month: string; count: number }[];
  monthlyAttendanceRate: number | null;
  pendingLeaveCount: number;
  onLeaveTodayCount: number;
  latestPeriod: {
    label: string; locked: boolean;
    grossUsd: number | null; count: number;
    finalizedCount: number;
    payrollDate: string | null;
    periodEndDate: string;
  } | null;
}

const DEPT_COLORS = ["#2d4a63", "#3a5f7d", "#1d9e75", "#185fa5", "#854f0b", "#3c3489", "#a32d2d", "#0f6e56"];

function KpiCard({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub?: string;
  accent?: "steel" | "green" | "amber" | "red" | "purple";
  icon?: React.ReactNode;
}) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    steel:  { bg: "var(--steel-light)", text: "var(--steel)",  dot: "var(--steel)" },
    green:  { bg: "var(--green-bg)",    text: "var(--green)",  dot: "var(--green)" },
    amber:  { bg: "var(--amber-bg)",    text: "var(--amber)",  dot: "var(--amber)" },
    red:    { bg: "var(--red-bg)",      text: "var(--red)",    dot: "var(--red)" },
    purple: { bg: "var(--purple-bg)",   text: "var(--purple)", dot: "var(--purple)" },
  };
  const c = colors[accent ?? "steel"];

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", color: c.text }}>
            {icon}
          </div>
        )}
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", lineHeight: 1, marginBottom: 6 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--text-3)" }}>{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>{children}</h2>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function DashboardClient({
  headcount, presentToday, leaveToday, absentToday,
  contractExpiring30, contractExpiring7,
  todayBirthdays, departments, recentOt, hiringByMonth,
  monthlyAttendanceRate, pendingLeaveCount, onLeaveTodayCount, latestPeriod,
}: Props) {
  const today = new Date();

  // Attendance donut data
  const totalAttendance = presentToday + leaveToday + absentToday;
  const noRecordToday = Math.max(0, headcount - totalAttendance);
  const attendanceData = headcount === 0
    ? [{ name: "No data", value: 1, color: "var(--border)" }]
    : [
        { name: "Present",   value: presentToday, color: "var(--green)" },
        { name: "Leave",     value: leaveToday,   color: "var(--amber)" },
        { name: "Absent",    value: absentToday,  color: "var(--red)" },
        { name: "No record", value: noRecordToday, color: "var(--border)" },
      ].filter(d => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>
          {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Alert banners */}
      {contractExpiring7 > 0 && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "var(--red-bg)", color: "var(--red)",
          fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 10,
          borderLeft: "4px solid var(--red)",
        }}>
          <span>🚨</span>
          <span>{contractExpiring7} employee contract{contractExpiring7 > 1 ? "s" : ""} expiring within 7 days</span>
          <Link href="/employees?filter=expiring" style={{ marginLeft: "auto", color: "var(--red)", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
            View →
          </Link>
        </div>
      )}
      {todayBirthdays.length > 0 && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "var(--purple-bg)", color: "var(--purple)",
          fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 10,
          borderLeft: "4px solid var(--purple)",
        }}>
          <span>🎂</span>
          <span>
            Today&apos;s birthdays:{" "}
            {todayBirthdays.map(e => e.nameEn).join(", ")}
          </span>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Total Employees" value={headcount} sub="Active"
          accent="steel"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <KpiCard
          label="Present Today" value={presentToday || "—"}
          sub={headcount > 0 ? `${Math.round(presentToday / headcount * 100)}% of workforce` : "No data"}
          accent="green"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <KpiCard
          label="On Leave" value={leaveToday || "—"} sub="Today"
          accent="amber"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
        />
        <KpiCard
          label="Monthly Rate"
          value={monthlyAttendanceRate !== null ? `${monthlyAttendanceRate}%` : "—"}
          sub="Attendance this month"
          accent={monthlyAttendanceRate === null ? "steel" : monthlyAttendanceRate >= 90 ? "green" : monthlyAttendanceRate >= 75 ? "amber" : "red"}
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        />
        <KpiCard
          label="Pending Leave" value={pendingLeaveCount}
          sub="Awaiting approval"
          accent={pendingLeaveCount > 0 ? "amber" : "steel"}
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>}
        />
        <KpiCard
          label="On Leave Today" value={onLeaveTodayCount}
          sub="Approved absence"
          accent={onLeaveTodayCount > 0 ? "purple" : "steel"}
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <KpiCard
          label="Contracts Expiring" value={contractExpiring30}
          sub="Next 30 days"
          accent={contractExpiring30 > 0 ? "red" : "steel"}
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        {latestPeriod && (
          <>
            <KpiCard
              label="Current Period" value={latestPeriod.label}
              sub={latestPeriod.locked ? "Closed ✓" : "Open"}
              accent={latestPeriod.locked ? "green" : "amber"}
              icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>}
            />
            {latestPeriod.payrollDate && (() => {
              const target = new Date(latestPeriod.payrollDate!); target.setHours(0, 0, 0, 0);
              const now = new Date(); now.setHours(0, 0, 0, 0);
              const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
              const label = diff === 0 ? "Today!" : diff < 0 ? `${Math.abs(diff)}d overdue` : `In ${diff} days`;
              const accent = diff < 0 ? "red" : diff <= 3 ? "amber" : "steel";
              return (
                <KpiCard
                  label="Payroll Date" value={label}
                  sub={new Date(latestPeriod.payrollDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  accent={accent}
                  icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                />
              );
            })()}
            {!latestPeriod.locked && (() => {
              const end = new Date(latestPeriod.periodEndDate); end.setHours(0, 0, 0, 0);
              const now = new Date(); now.setHours(0, 0, 0, 0);
              const days = Math.round((end.getTime() - now.getTime()) / 86400000);
              return (
                <KpiCard
                  label="Period Ends"
                  value={days < 0 ? "Ended" : days === 0 ? "Today" : `${days} days`}
                  sub={new Date(latestPeriod.periodEndDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  accent={days < 0 ? "red" : days <= 2 ? "amber" : "steel"}
                  icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
                />
              );
            })()}
            <KpiCard
              label="Payroll Gross"
              value={latestPeriod.grossUsd != null ? `$${latestPeriod.grossUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              sub={latestPeriod.count > 0 ? `${latestPeriod.count} payslips` : "Not yet run"}
              accent="steel"
            />
            <KpiCard
              label="Employees Paid"
              value={latestPeriod.finalizedCount > 0 ? latestPeriod.finalizedCount : latestPeriod.count > 0 ? `${latestPeriod.count} draft` : "—"}
              sub={latestPeriod.finalizedCount > 0 ? "Finalized payslips" : "Awaiting finalization"}
              accent={latestPeriod.finalizedCount > 0 ? "green" : latestPeriod.count > 0 ? "amber" : "steel"}
              icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Hiring trend */}
        <Panel>
          <SectionTitle>Hiring Trends (last 6 months)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hiringByMonth} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--surface)", color: "var(--text)" }}
                cursor={{ fill: "var(--surface-2)" }}
              />
              <Bar dataKey="count" name="New hires" fill="var(--steel)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Attendance donut */}
        <Panel>
          <SectionTitle>Today&apos;s Attendance</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={attendanceData}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {attendanceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--surface)", color: "var(--text)" }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Department + OT row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Department breakdown */}
        <Panel>
          <SectionTitle>Headcount by Department</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {departments.filter(d => d.count > 0).map((d, i) => {
              const pct = headcount > 0 ? (d.count / headcount) * 100 : 0;
              return (
                <div key={d.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{d.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{d.count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      background: DEPT_COLORS[i % DEPT_COLORS.length],
                      width: `${pct}%`,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Recent OT */}
        <Panel>
          <SectionTitle>Recent Overtime</SectionTitle>
          {recentOt.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>No overtime logged yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentOt.slice(0, 6).map(o => (
                <div key={o.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{o.employee.nameEn}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {fmt(o.date)} · {o.hours}h · {o.band.replace(/_/g, " ")}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                    ${o.amountUsd.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
