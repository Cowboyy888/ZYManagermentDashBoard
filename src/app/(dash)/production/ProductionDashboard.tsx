"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, Legend,
} from "recharts";
import dynamic from "next/dynamic";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveOrder = {
  id: number; orderCode: string; customer: string | null; priority: string;
  plannedDate: string; machine: { code: string; name: string } | null;
  supervisor: { nameEn: string } | null; qtyOrdered: number; qtyProduced: number;
};

type RecentReport = {
  id: string; reportDate: string; shift: string;
  meshKg: number; wireKg: number; headcount: number; downtimeMin: number;
  factoryArea: { name: string; code: string } | null;
  supervisor: { nameEn: string } | null;
};

type Summary = {
  today: { meshKg: number; wireKg: number; downtimeMin: number };
  monthly: { meshKg: number; wireKg: number; downtimeMin: number };
  ordersByStatus: { status: string; count: number }[];
  machinesByStatus: { status: string; count: number }[];
  activeOrders: ActiveOrder[];
  recentReports: RecentReport[];
  qc: { passCount: number; failCount: number; reworkCount: number; passRate: number | null; defectRate: number | null; total: number };
  openMaintenance: number;
  productionTrend: { month: string; kg: number }[];
};

interface Props {
  summary: Summary;
  canManage: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  HIGH:   { background: "var(--red-bg)",   color: "var(--red)" },
  MEDIUM: { background: "var(--amber-bg)", color: "var(--amber)" },
  LOW:    { background: "var(--blue-bg)",  color: "var(--blue)" },
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  DRAFT: "var(--text-3)", IN_PROGRESS: "var(--amber)", COMPLETED: "var(--green)", CANCELLED: "var(--red)",
};

const MACHINE_STATUS_COLOR: Record<string, string> = {
  OPERATIONAL: "var(--green)", UNDER_MAINTENANCE: "var(--amber)", RETIRED: "var(--text-3)",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function kpiCard(label: string, value: string | number, sub?: string, color = "var(--text)") {
  return (
    <div className="kpi-card">
      <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductionDashboard({ summary }: Props) {
  const { today, monthly, ordersByStatus, machinesByStatus, activeOrders, recentReports, qc, openMaintenance, productionTrend } = summary;

  const totalMachines   = machinesByStatus.reduce((s, m) => s + m.count, 0);
  const operational     = machinesByStatus.find((m) => m.status === "OPERATIONAL")?.count ?? 0;
  const utilizationPct  = totalMachines > 0 ? Math.round((operational / totalMachines) * 100) : null;

  const totalOrders     = ordersByStatus.reduce((s, o) => s + o.count, 0);
  const inProgress      = ordersByStatus.find((o) => o.status === "IN_PROGRESS")?.count ?? 0;
  const completedOrders = ordersByStatus.find((o) => o.status === "COMPLETED")?.count ?? 0;

  const kpiExport = useMemo(() => [
    { Metric: "Today Mesh Output (kg)", Value: today.meshKg },
    { Metric: "Today Wire Consumed (kg)", Value: today.wireKg },
    { Metric: "Today Downtime (min)", Value: today.downtimeMin },
    { Metric: "Monthly Mesh Output (kg)", Value: monthly.meshKg },
    { Metric: "Monthly Wire Consumed (kg)", Value: monthly.wireKg },
    { Metric: "Monthly Downtime (min)", Value: monthly.downtimeMin },
    { Metric: "Machines Operational", Value: operational },
    { Metric: "Machine Utilization %", Value: utilizationPct ?? "N/A" },
    { Metric: "Orders In Progress", Value: inProgress },
    { Metric: "Orders Completed (all-time)", Value: completedOrders },
    { Metric: "QC Pass Rate % (30d)", Value: qc.passRate ?? "N/A" },
    { Metric: "Defect Rate % (30d)", Value: qc.defectRate ?? "N/A" },
    { Metric: "Open Maintenance Jobs", Value: openMaintenance },
  ], [today, monthly, operational, utilizationPct, inProgress, completedOrders, qc, openMaintenance]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Alert strip ── */}
      {(openMaintenance > 0 || (qc.passRate !== null && qc.passRate < 80)) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {openMaintenance > 0 && (
            <div style={{ padding: "9px 14px", borderRadius: 8, background: "var(--amber-bg)", color: "var(--amber)", fontSize: 13, fontWeight: 500 }}>
              {openMaintenance} open maintenance job{openMaintenance !== 1 ? "s" : ""} pending completion
            </div>
          )}
          {qc.passRate !== null && qc.passRate < 80 && (
            <div style={{ padding: "9px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, fontWeight: 500 }}>
              QC pass rate is {qc.passRate}% (last 30 days) — below 80% threshold
            </div>
          )}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ExportMenu
          title="Production KPIs"
          filename="production-kpis"
          data={kpiExport}
          columns={[{ key: "Metric", header: "Metric" }, { key: "Value", header: "Value" }]}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {kpiCard("Today's Output (kg)", today.meshKg.toLocaleString(), "mesh produced today", today.meshKg > 0 ? "var(--steel)" : "var(--text-3)")}
        {kpiCard("Monthly Output (kg)", monthly.meshKg.toLocaleString(), "mesh this month")}
        {kpiCard("In Progress", inProgress, `${totalOrders} total orders`, inProgress > 0 ? "var(--amber)" : "var(--text-3)")}
        {kpiCard("Completed Orders", completedOrders, "all time", "var(--green)")}
        {kpiCard("Machine Utilization", utilizationPct !== null ? `${utilizationPct}%` : "—", `${operational} / ${totalMachines} operational`, utilizationPct !== null && utilizationPct < 60 ? "var(--red)" : "var(--green)")}
        {kpiCard("QC Pass Rate", qc.passRate !== null ? `${qc.passRate}%` : "—", "last 30 days", qc.passRate !== null ? (qc.passRate >= 95 ? "var(--green)" : qc.passRate >= 80 ? "var(--amber)" : "var(--red)") : "var(--text-3)")}
        {kpiCard("Defect Rate", qc.defectRate !== null ? `${qc.defectRate}%` : "—", "of sampled units", qc.defectRate !== null && qc.defectRate > 5 ? "var(--red)" : "var(--text-3)")}
        {kpiCard("Open Maintenance", openMaintenance, "jobs pending", openMaintenance > 0 ? "var(--amber)" : "var(--text-3)")}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Monthly production trend */}
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Monthly Output Trend (kg)</span></div>
          <div className="panel-body" style={{ padding: "12px 8px" }}>
            {productionTrend.every((p) => p.kg === 0) ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No production data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={productionTrend} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} width={40} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="kg" stroke="var(--steel)" strokeWidth={2} dot={{ r: 3, fill: "var(--steel)" }} name="Mesh (kg)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Orders by status + machines by status */}
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Orders & Machines Status</span></div>
          <div className="panel-body" style={{ padding: "12px 8px" }}>
            {ordersByStatus.length === 0 && machinesByStatus.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ordersByStatus.map((o) => ({ name: o.status.replace("_", " "), count: o.count }))} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} allowDecimals={false} width={30} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]}>
                    {ordersByStatus.map((o) => <Cell key={o.status} fill={ORDER_STATUS_COLOR[o.status] ?? "var(--steel)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Machine status strip ── */}
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Machine Status</span></div>
        <div className="panel-body" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {machinesByStatus.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>No machines registered. <a href="/production/machines" style={{ color: "var(--steel)" }}>Add machines →</a></span>
          ) : machinesByStatus.map((m) => (
            <div key={m.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: MACHINE_STATUS_COLOR[m.status] + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: MACHINE_STATUS_COLOR[m.status] }}>{m.count}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: MACHINE_STATUS_COLOR[m.status] }}>{m.status.replace("_", " ")}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {totalMachines > 0 ? `${Math.round((m.count / totalMachines) * 100)}%` : "—"}
                </div>
              </div>
              {totalMachines > 0 && (
                <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((m.count / totalMachines) * 100)}%`, height: "100%", background: MACHINE_STATUS_COLOR[m.status], borderRadius: 3 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Active orders ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Active Production Orders</span>
          <a href="/production/orders" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View all →</a>
        </div>
        {activeOrders.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No orders in progress</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Priority</th><th>Machine</th>
                  <th>Planned</th><th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((o) => {
                  const pct = o.qtyOrdered > 0 ? Math.min(100, Math.round((o.qtyProduced / o.qtyOrdered) * 100)) : 0;
                  return (
                    <tr key={o.id}>
                      <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{o.orderCode}</code></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{o.customer ?? "—"}</td>
                      <td><span className="tag" style={PRIORITY_STYLE[o.priority] ?? {}}>{o.priority}</span></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{o.machine?.code ?? "—"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>{fmtDate(o.plannedDate)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--green)" : "var(--steel)", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                            {o.qtyProduced}/{o.qtyOrdered} ({pct}%)
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent shift reports ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Recent Shift Reports (7 days)</span>
          <a href="/production/reports" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View all →</a>
        </div>
        {recentReports.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No shift reports logged yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Shift</th><th>Area</th><th>Mesh (kg)</th><th>Wire (kg)</th><th>Headcount</th><th>Downtime</th><th>Supervisor</th></tr>
              </thead>
              <tbody>
                {recentReports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fmtDate(r.reportDate)}</td>
                    <td>
                      <span className="tag" style={{ background: "var(--steel-light)", color: "var(--steel)" }}>{r.shift}</span>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.factoryArea?.code ?? "—"}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.meshKg.toLocaleString()}</td>
                    <td className="num" style={{ color: "var(--text-2)" }}>{r.wireKg.toLocaleString()}</td>
                    <td className="num">{r.headcount}</td>
                    <td className="num" style={{ color: r.downtimeMin > 60 ? "var(--amber)" : "var(--text-2)", fontSize: 12.5 }}>
                      {r.downtimeMin > 0 ? `${r.downtimeMin}m` : "—"}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.supervisor?.nameEn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── QC summary ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Quality Control (Last 30 Days)</span>
          <a href="/production/quality" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View all →</a>
        </div>
        <div className="panel-body">
          {qc.total === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, padding: "20px 0" }}>No QC inspections in last 30 days</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              <div className="kpi-card">
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Pass Rate</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: qc.passRate !== null ? (qc.passRate >= 95 ? "var(--green)" : qc.passRate >= 80 ? "var(--amber)" : "var(--red)") : "var(--text-3)" }}>
                  {qc.passRate !== null ? `${qc.passRate}%` : "—"}
                </div>
              </div>
              <div className="kpi-card">
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Passed</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{qc.passCount}</div>
              </div>
              <div className="kpi-card">
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Failed</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: qc.failCount > 0 ? "var(--red)" : "var(--text-3)" }}>{qc.failCount}</div>
              </div>
              <div className="kpi-card">
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Rework</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: qc.reworkCount > 0 ? "var(--amber)" : "var(--text-3)" }}>{qc.reworkCount}</div>
              </div>
              <div className="kpi-card">
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Defect Rate</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: qc.defectRate !== null && qc.defectRate > 5 ? "var(--red)" : "var(--text-2)" }}>
                  {qc.defectRate !== null ? `${qc.defectRate}%` : "—"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
