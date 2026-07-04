"use client";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  totalMachines: number; operational: number; underMaintenance: number; offline: number;
  availability: number; openWOs: number; overdueWOs: number; dueThisWeek: number;
  monthlyCostUsd: number; downtimeThisMonthMin: number;
  monthlyTrend: { month: string; total: number; cost: number; preventive: number; corrective: number }[];
  woByStatus: { status: string; count: number }[];
  recentWOs: { id: number; woNumber: string; title: string; type: string; priority: string; status: string; machineCode: string; machineName: string; scheduledDate: string; completedAt: string | null; assignedToName: string | null }[];
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#f59e0b", IN_PROGRESS: "#6366f1", ON_HOLD: "#94a3b8", COMPLETED: "#10b981", CANCELLED: "#ef4444",
};
const PRIORITY_COLORS: Record<string, string> = { LOW: "#94a3b8", MEDIUM: "#f59e0b", HIGH: "#f97316", URGENT: "#ef4444" };

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }

export function MaintenanceAnalytics({ data }: { data: Data }) {
  const mttrHours = data.monthlyTrend.length > 0
    ? (() => {
        const totalCorrective = data.monthlyTrend.reduce((s, m) => s + m.corrective, 0);
        return totalCorrective > 0 ? Math.round((data.downtimeThisMonthMin / 60 / totalCorrective) * 10) / 10 : null;
      })()
    : null;

  const mtbfHours = data.totalMachines > 0 && data.downtimeThisMonthMin > 0
    ? Math.round(((data.totalMachines * 730 - data.downtimeThisMonthMin / 60) / Math.max(data.monthlyTrend[data.monthlyTrend.length - 1]?.corrective ?? 1, 1)) * 10) / 10
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.availability >= 85 ? "#10b981" : data.availability >= 70 ? "#f59e0b" : "#ef4444"}` }}>
          <div className="kpi-label">Machine Availability</div>
          <div className="kpi-value" style={{ color: data.availability >= 85 ? "#10b981" : data.availability >= 70 ? "#f59e0b" : "#ef4444" }}>{data.availability}%</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{data.operational}/{data.totalMachines} operational</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">MTTR (est.)</div>
          <div className="kpi-value">{mttrHours !== null ? `${mttrHours}h` : "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>mean time to repair</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">MTBF (est.)</div>
          <div className="kpi-value">{mtbfHours !== null ? `${mtbfHours}h` : "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>mean time between failures</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.overdueWOs > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Open Work Orders</div>
          <div className="kpi-value">{data.openWOs}</div>
          <div style={{ fontSize: 11, color: data.overdueWOs > 0 ? "#ef4444" : "var(--text-3)" }}>{data.overdueWOs} overdue</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Monthly Cost</div>
          <div className="kpi-value">{fmtUsd(data.monthlyCostUsd)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.offline > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Offline Machines</div>
          <div className="kpi-value" style={{ color: data.offline > 0 ? "#ef4444" : "#10b981" }}>{data.offline}</div>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="panel">
        <div className="panel-head">Work Order Trend (6 Months)</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="preventive" name="Preventive" fill="#6366f1" stackId="a" />
              <Bar dataKey="corrective" name="Corrective" fill="#f59e0b" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost trend + WO status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Monthly Maintenance Cost</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [fmtUsd(v), "Cost"]} />
                <Bar dataKey="cost" name="Cost ($)" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Work Orders by Status</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.woByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ status, count }) => `${status} (${count})`} labelLine={false}>
                  {data.woByStatus.map((w) => <Cell key={w.status} fill={STATUS_COLORS[w.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent WOs */}
      <div className="panel">
        <div className="panel-head">Recent Work Orders</div>
        <div style={{ padding: 0 }}>
          <table className="data-table">
            <thead><tr><th>WO #</th><th>Title</th><th>Machine</th><th>Type</th><th>Priority</th><th>Status</th><th>Assigned</th></tr></thead>
            <tbody>
              {data.recentWOs.slice(0, 8).map((w) => (
                <tr key={w.id}>
                  <td><code style={{ fontSize: 11 }}>{w.woNumber}</code></td>
                  <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</td>
                  <td style={{ fontSize: 12 }}>{w.machineCode}</td>
                  <td style={{ fontSize: 11 }}>{w.type}</td>
                  <td><span style={{ fontSize: 10, fontWeight: 600, color: PRIORITY_COLORS[w.priority] ?? "#94a3b8" }}>{w.priority}</span></td>
                  <td><span className="tag" style={{ fontSize: 10, background: (STATUS_COLORS[w.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[w.status] ?? "#94a3b8" }}>{w.status}</span></td>
                  <td style={{ fontSize: 12 }}>{w.assignedToName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
