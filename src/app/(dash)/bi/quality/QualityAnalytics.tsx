"use client";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  totalInspections: number; passCount: number; failCount: number; reworkCount: number;
  passRate: number | null; openNCRs: number; criticalNCRs: number; overdueCapas: number; certThisMonth: number;
  inspectionsByType: { type: string; count: number }[];
  ncrsBySeverity: { severity: string; count: number }[];
  ncrsByStatus: { status: string; count: number }[];
  trend: { month: string; pass: number; fail: number; rework: number }[];
};

const SEV_COLORS: Record<string, string> = { CRITICAL: "#ef4444", MAJOR: "#f97316", MINOR: "#f59e0b", OBSERVATION: "#6366f1" };
const RESULT_COLORS = { pass: "#10b981", fail: "#ef4444", rework: "#f59e0b" };

export function QualityAnalytics({ data }: { data: Data }) {
  const failRate = data.totalInspections > 0 ? Math.round((data.failCount / data.totalInspections) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.passRate !== null && data.passRate >= 95 ? "#10b981" : "#ef4444"}` }}>
          <div className="kpi-label">Pass Rate (Month)</div>
          <div className="kpi-value" style={{ color: data.passRate !== null && data.passRate >= 95 ? "#10b981" : data.passRate !== null && data.passRate >= 80 ? "#f59e0b" : "#ef4444" }}>
            {data.passRate !== null ? `${data.passRate}%` : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{data.totalInspections} inspections</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${failRate > 10 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Defect Rate</div>
          <div className="kpi-value" style={{ color: failRate > 10 ? "#ef4444" : "#10b981" }}>{failRate}%</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{data.failCount} failures</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.openNCRs > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Open NCRs</div>
          <div className="kpi-value" style={{ color: data.openNCRs > 0 ? "#ef4444" : "#10b981" }}>{data.openNCRs}</div>
          <div style={{ fontSize: 11, color: data.criticalNCRs > 0 ? "#ef4444" : "var(--text-3)" }}>{data.criticalNCRs} critical</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.overdueCapas > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Overdue CAPAs</div>
          <div className="kpi-value" style={{ color: data.overdueCapas > 0 ? "#ef4444" : "#10b981" }}>{data.overdueCapas}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Certs Issued</div>
          <div className="kpi-value">{data.certThisMonth}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>this month</div>
        </div>
      </div>

      {/* Pass/Fail Trend */}
      <div className="panel">
        <div className="panel-head">Inspection Results Trend (6 Months)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pass" name="Pass" fill={RESULT_COLORS.pass} stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="rework" name="Rework" fill={RESULT_COLORS.rework} stackId="a" />
              <Bar dataKey="fail" name="Fail" fill={RESULT_COLORS.fail} stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NCR charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">NCR by Severity</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.ncrsBySeverity} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={70} label={({ severity, count }) => `${severity} (${count})`} labelLine={false}>
                  {data.ncrsBySeverity.map((n) => <Cell key={n.severity} fill={SEV_COLORS[n.severity] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">NCR by Status</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.ncrsByStatus} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="NCRs" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">Inspections by Type</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.inspectionsByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} label={({ type, count }) => `${count}`} labelLine={false}>
                  {data.inspectionsByType.map((_, i) => <Cell key={i} fill={["#6366f1", "#10b981", "#f59e0b", "#ef4444"][i % 4]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
