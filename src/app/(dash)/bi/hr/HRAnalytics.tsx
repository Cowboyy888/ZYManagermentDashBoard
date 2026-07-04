"use client";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  headcount: number; terminatedLast6mo: number; turnoverRate: number;
  monthlyAttRate: number | null;
  attendanceTrend: { date: string; rate: number; present: number; total: number }[];
  leaveByType: { type: string; count: number }[];
  leaveTrend: { month: string; count: number }[];
  otTrend: { month: string; hours: number; cost: number }[];
  departmentHeadcount: { id: number; name: string; count: number }[];
  contractExpiring: { id: number; nameEn: string; contractExpiry: string; department: string | null; position: string | null; daysLeft: number }[];
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

export function HRAnalytics({ data }: { data: Data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Active Employees</div>
          <div className="kpi-value">{data.headcount}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Attendance Rate</div>
          <div className="kpi-value" style={{ color: data.monthlyAttRate !== null && data.monthlyAttRate >= 90 ? "#10b981" : "#f59e0b" }}>
            {data.monthlyAttRate !== null ? `${data.monthlyAttRate}%` : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>this month</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="kpi-label">Turnover Rate (6mo)</div>
          <div className="kpi-value" style={{ color: data.turnoverRate > 5 ? "#ef4444" : "#10b981" }}>{data.turnoverRate}%</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{data.terminatedLast6mo} terminations</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.contractExpiring.length > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Contracts Expiring</div>
          <div className="kpi-value" style={{ color: data.contractExpiring.length > 0 ? "#ef4444" : "#10b981" }}>{data.contractExpiring.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>within 90 days</div>
        </div>
      </div>

      {/* Attendance Trend */}
      <div className="panel">
        <div className="panel-head">Daily Attendance Rate (Last 90 Days)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(data.attendanceTrend.length / 8)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [`${v}%`, "Attendance"]} />
              <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Department Headcount */}
        <div className="panel">
          <div className="panel-head">Department Headcount</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.departmentHeadcount} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
                <Bar dataKey="count" name="Employees" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leave by Type */}
        <div className="panel">
          <div className="panel-head">Leave by Type (6 months)</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.leaveByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {data.leaveByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* OT Trend */}
      <div className="panel">
        <div className="panel-head">Overtime Trend (6 Months)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.otTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="hours" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="hours" dataKey="hours" name="OT Hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="cost" dataKey="cost" name="OT Cost ($)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leave Monthly Trend */}
      <div className="panel">
        <div className="panel-head">Monthly Leave Usage</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.leaveTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [v, "Leave Days"]} />
              <Bar dataKey="count" name="Leave Taken" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Contract Expiry */}
      {data.contractExpiring.length > 0 && (
        <div className="panel">
          <div className="panel-head">Contract Expiry Forecast (Next 90 Days)</div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Department</th><th>Position</th><th>Expiry Date</th><th>Days Left</th></tr></thead>
              <tbody>
                {data.contractExpiring.map((e) => (
                  <tr key={e.id} style={{ background: e.daysLeft <= 30 ? "var(--red-bg)" : e.daysLeft <= 60 ? "#f59e0b10" : undefined }}>
                    <td style={{ fontWeight: 600 }}>{e.nameEn}</td>
                    <td style={{ fontSize: 12 }}>{e.department ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>{e.position ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>{new Date(e.contractExpiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td style={{ fontWeight: 700, color: e.daysLeft <= 30 ? "#ef4444" : e.daysLeft <= 60 ? "#f59e0b" : "#10b981" }}>{e.daysLeft}d</td>
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
