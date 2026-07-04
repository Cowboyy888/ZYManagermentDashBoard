"use client";

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface RecentWO {
  id: number;
  woNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  machineCode: string;
  machineName: string;
  scheduledDate: string;
  completedAt: string | null;
  assignedToName: string | null;
}

interface Summary {
  totalMachines: number;
  operational: number;
  underMaintenance: number;
  offline: number;
  availability: number;
  openWOs: number;
  overdueWOs: number;
  dueThisWeek: number;
  monthlyCostUsd: number;
  downtimeThisMonthMin: number;
  woByStatus: { status: string; count: number }[];
  monthlyTrend: { month: string; preventive: number; corrective: number; total: number; cost: number }[];
  recentWOs: RecentWO[];
}

interface Props {
  summary: Summary;
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#6366f1",
  IN_PROGRESS: "#f59e0b",
  ON_HOLD: "#94a3b8",
  COMPLETE: "#10b981",
  CANCELLED: "#ef4444",
};

const MACHINE_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#94a3b8"];

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

function fmt(n: number | null) {
  if (n === null) return "—";
  return n.toLocaleString();
}

function fmtCost(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MaintenanceDashboard({ summary, canManage: _canManage }: Props) {
  const machineStatusData = [
    { name: "Operational", value: summary.operational },
    { name: "Maintenance", value: summary.underMaintenance },
    { name: "Offline", value: summary.offline },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI row 1 — Machine Status */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Machines</div>
          <div className="kpi-value">{summary.totalMachines}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Operational</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{summary.operational}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="kpi-label">Under Maintenance</div>
          <div className="kpi-value" style={{ color: "#f59e0b" }}>{summary.underMaintenance}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Offline</div>
          <div className="kpi-value" style={{ color: "#6366f1" }}>{summary.offline}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Availability</div>
          <div className="kpi-value" style={{ color: summary.availability >= 85 ? "#10b981" : "#ef4444" }}>
            {summary.availability.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* KPI row 2 — Work Orders & PM */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card">
          <div className="kpi-label">Open Work Orders</div>
          <div className="kpi-value">{summary.openWOs}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="kpi-label">Overdue WOs</div>
          <div className="kpi-value" style={{ color: summary.overdueWOs > 0 ? "#ef4444" : "var(--text)" }}>
            {summary.overdueWOs}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">PM Due This Week</div>
          <div className="kpi-value" style={{ color: summary.dueThisWeek > 0 ? "#f59e0b" : "var(--text)" }}>
            {summary.dueThisWeek}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Monthly Cost</div>
          <div className="kpi-value">{fmtCost(summary.monthlyCostUsd)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Downtime This Month</div>
          <div className="kpi-value">{fmt(summary.downtimeThisMonthMin)} min</div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {/* Monthly WO Trend */}
        <div className="panel" style={{ gridColumn: "span 2" }}>
          <div className="panel-head">Monthly Work Order Trend (6 months)</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.monthlyTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="preventive" name="Preventive" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="corrective" name="Corrective / Other" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Machine Status Pie */}
        <div className="panel">
          <div className="panel-head">Machine Status</div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={machineStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {machineStatusData.map((_, i) => (
                    <Cell key={i} fill={MACHINE_COLORS[i % MACHINE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="panel">
        <div className="panel-head">Recent Work Orders</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>WO #</th>
                <th>Title</th>
                <th>Machine</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Scheduled</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentWOs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No work orders yet</td></tr>
              ) : summary.recentWOs.map((wo) => (
                <tr key={wo.id}>
                  <td><code style={{ fontSize: 11 }}>{wo.woNumber}</code></td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wo.title}</td>
                  <td><span style={{ fontSize: 12 }}>{wo.machineCode} — {wo.machineName}</span></td>
                  <td>
                    <span className="tag" style={{ background: PRIORITY_COLORS[wo.priority] + "20", color: PRIORITY_COLORS[wo.priority], fontSize: 11 }}>
                      {wo.priority}
                    </span>
                  </td>
                  <td>
                    <span className="tag" style={{ background: (STATUS_COLORS[wo.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[wo.status] ?? "#94a3b8", fontSize: 11 }}>
                      {wo.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{fmtDate(wo.scheduledDate)}</td>
                  <td style={{ fontSize: 12 }}>{wo.assignedToName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
