"use client";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Data = {
  totalMachines: number; operational: number; availability: number;
  monthKg: number; monthDowntimeHours: number;
  dailyTrend: { date: string; kg: number; downtimeMin: number }[];
  productionTrend: { month: string; kg: number; downtimeHours: number }[];
  machinesByStatus: { status: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: "#10b981", UNDER_MAINTENANCE: "#f59e0b", OFFLINE: "#ef4444", RETIRED: "#94a3b8",
};
const ORDER_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", PLANNED: "#6366f1", IN_PROGRESS: "#f59e0b", COMPLETED: "#10b981", CANCELLED: "#ef4444",
};

export function ProductionAnalytics({ data }: { data: Data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Production (Month)</div>
          <div className="kpi-value">{data.monthKg.toLocaleString()} kg</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.availability >= 85 ? "#10b981" : "#f59e0b"}` }}>
          <div className="kpi-label">Machine Availability</div>
          <div className="kpi-value" style={{ color: data.availability >= 85 ? "#10b981" : "#f59e0b" }}>{data.availability}%</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{data.operational}/{data.totalMachines} operational</div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${data.monthDowntimeHours > 0 ? "#ef4444" : "#10b981"}` }}>
          <div className="kpi-label">Downtime (Month)</div>
          <div className="kpi-value" style={{ color: data.monthDowntimeHours > 0 ? "#ef4444" : "#10b981" }}>{data.monthDowntimeHours}h</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Orders</div>
          <div className="kpi-value">{data.ordersByStatus.find((o) => ["PLANNED", "IN_PROGRESS"].includes(o.status))?.count ?? 0}</div>
        </div>
      </div>

      {/* Daily trend */}
      <div className="panel">
        <div className="panel-head">Daily Production Output</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.dailyTrend.length / 10))} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}kg`} />
              <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [`${v} kg`, "Output"]} />
              <Line type="monotone" dataKey="kg" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly trend + machine status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Monthly Production Trend (6 Months)</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.productionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}t`} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [`${v.toLocaleString()} kg`, "Production"]} />
                <Bar dataKey="kg" name="Production" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Machine Status Breakdown</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.machinesByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status} (${count})`} labelLine={false}>
                  {data.machinesByStatus.map((m) => <Cell key={m.status} fill={STATUS_COLORS[m.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Downtime trend + order pipeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">Monthly Downtime (hours)</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.productionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} formatter={(v: number) => [`${v}h`, "Downtime"]} />
                <Bar dataKey="downtimeHours" name="Downtime (h)" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Order Pipeline by Status</div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.ordersByStatus} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
                <Bar dataKey="count" name="Orders" radius={[0, 3, 3, 0]}>
                  {data.ordersByStatus.map((o) => <Cell key={o.status} fill={ORDER_COLORS[o.status] ?? "#94a3b8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
