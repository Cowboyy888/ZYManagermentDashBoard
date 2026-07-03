"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface WorkOrder {
  id: number;
  woNumber: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  machineId: number;
  machineCode: string;
  machineName: string;
  assignedToName: string | null;
  scheduledDate: string;
  completedAt: string | null;
  downtimeMinutes: number | null;
  laborHours: number | null;
  totalCostUsd: number | null;
  createdAt: string;
}

interface UsageRecord {
  id: number;
  woNumber: string;
  machineCode: string;
  machineName: string;
  itemCode: string;
  itemName: string;
  quantityUsed: number;
  totalCostUsd: number | null;
  createdAt: string;
}

interface Machine {
  id: number;
  code: string;
  name: string;
  type: string;
  status: string;
}

interface Props {
  workOrders: WorkOrder[];
  usages: UsageRecord[];
  machines: Machine[];
  canExport: boolean;
}

type Tab = "history" | "downtime" | "pm" | "parts" | "cost";

const TAB_LABELS: Record<Tab, string> = {
  history: "Maintenance History",
  downtime: "Downtime Report",
  pm: "PM Compliance",
  parts: "Spare Parts",
  cost: "Cost Report",
};

const TYPE_COLORS: Record<string, string> = {
  PREVENTIVE: "#10b981", CORRECTIVE: "#f59e0b", EMERGENCY: "#ef4444",
  INSPECTION: "#6366f1", UPGRADE: "#a855f7",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtCost(n: number | null) {
  if (n === null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function getMonth(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MaintenanceReports({ workOrders, usages, machines, canExport: _canExport }: Props) {
  const [tab, setTab] = useState<Tab>("history");
  const [historySearch, setHistorySearch] = useState("");
  const [machineFilter, setMachineFilter] = useState("ALL");

  // History tab
  const filteredWOs = useMemo(() => workOrders.filter((w) => {
    const matchSearch = !historySearch || `${w.woNumber} ${w.title} ${w.machineCode}`.toLowerCase().includes(historySearch.toLowerCase());
    const matchMachine = machineFilter === "ALL" || String(w.machineId) === machineFilter;
    return matchSearch && matchMachine;
  }), [workOrders, historySearch, machineFilter]);

  // Monthly cost trend
  const costTrend = useMemo(() => {
    const byMonth: Record<string, { month: string; cost: number; count: number }> = {};
    workOrders.forEach((w) => {
      if (w.completedAt) {
        const m = getMonth(w.completedAt);
        if (!byMonth[m]) byMonth[m] = { month: m, cost: 0, count: 0 };
        byMonth[m].cost += w.totalCostUsd ?? 0;
        byMonth[m].count += 1;
      }
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [workOrders]);

  // WO by type
  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    workOrders.forEach((w) => { counts[w.type] = (counts[w.type] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [workOrders]);

  // Downtime by machine
  const downtimeByMachine = useMemo(() => {
    const map: Record<string, { machine: string; minutes: number; wos: number }> = {};
    workOrders.forEach((w) => {
      if (w.downtimeMinutes) {
        const key = w.machineCode;
        if (!map[key]) map[key] = { machine: w.machineCode, minutes: 0, wos: 0 };
        map[key].minutes += w.downtimeMinutes;
        map[key].wos += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.minutes - a.minutes).slice(0, 10);
  }, [workOrders]);

  // PM Compliance
  const pmCompliance = useMemo(() => {
    const pm = workOrders.filter((w) => w.type === "PREVENTIVE");
    const completed = pm.filter((w) => w.status === "COMPLETE").length;
    const onTime = pm.filter((w) => w.status === "COMPLETE" && w.completedAt && w.completedAt <= w.scheduledDate).length;
    const rate = pm.length > 0 ? Math.round((completed / pm.length) * 100) : 0;
    const otRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0;
    return { total: pm.length, completed, onTime, rate, otRate };
  }, [workOrders]);

  // Spare parts cost by item
  const partsCostByItem = useMemo(() => {
    const map: Record<string, { name: string; qty: number; cost: number }> = {};
    usages.forEach((u) => {
      const key = u.itemCode;
      if (!map[key]) map[key] = { name: u.itemName, qty: 0, cost: 0 };
      map[key].qty += u.quantityUsed;
      map[key].cost += u.totalCostUsd ?? 0;
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost).slice(0, 10);
  }, [usages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            className="btn"
            onClick={() => setTab(t)}
            style={{
              borderRadius: 0, borderBottom: tab === t ? "2px solid var(--primary)" : "none",
              fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--primary)" : "var(--text-2)",
              background: "transparent", fontSize: 13,
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Maintenance History */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <input className="input" placeholder="Search WO#, title, machine..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ minWidth: 240 }} />
            <select className="input" value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} style={{ width: 200 }}>
              <option value="ALL">All Machines</option>
              {machines.map((m) => <option key={m.id} value={String(m.id)}>{m.code} — {m.name}</option>)}
            </select>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)", alignSelf: "center" }}>{filteredWOs.length} records</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div className="panel">
              <div className="panel-head">Work Orders by Type</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                      {byType.map((d, i) => <Cell key={i} fill={TYPE_COLORS[d.name] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Monthly Cost Trend</div>
              <div className="panel-body">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={costTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => fmtCost(v)} />
                    <Line type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} name="Cost (USD)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="panel">
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>WO #</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Machine</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                    <th>Completed</th>
                    <th>Downtime</th>
                    <th>Labor Hrs</th>
                    <th>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWOs.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No records</td></tr>
                  ) : filteredWOs.map((w) => (
                    <tr key={w.id}>
                      <td><code style={{ fontSize: 11 }}>{w.woNumber}</code></td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</td>
                      <td style={{ fontSize: 11 }}>
                        <span className="tag" style={{ background: (TYPE_COLORS[w.type] ?? "#94a3b8") + "20", color: TYPE_COLORS[w.type] ?? "#94a3b8", fontSize: 10 }}>{w.type}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>{w.machineCode}</td>
                      <td style={{ fontSize: 11 }}>{w.status.replace("_", " ")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(w.scheduledDate)}</td>
                      <td style={{ fontSize: 12 }}>{w.completedAt ? fmtDate(w.completedAt) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{w.downtimeMinutes != null ? `${w.downtimeMinutes} min` : "—"}</td>
                      <td style={{ fontSize: 12 }}>{w.laborHours ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{fmtCost(w.totalCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Downtime Report */}
      {tab === "downtime" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total Downtime</div>
              <div className="kpi-value">
                {Math.round(workOrders.reduce((s, w) => s + (w.downtimeMinutes ?? 0), 0) / 60)} hrs
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Emergency WOs</div>
              <div className="kpi-value" style={{ color: "#ef4444" }}>{workOrders.filter((w) => w.type === "EMERGENCY").length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg Downtime / WO</div>
              <div className="kpi-value">
                {(() => {
                  const wosWithDt = workOrders.filter((w) => w.downtimeMinutes);
                  if (!wosWithDt.length) return "—";
                  return Math.round(wosWithDt.reduce((s, w) => s + (w.downtimeMinutes ?? 0), 0) / wosWithDt.length) + " min";
                })()}
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Top 10 Machines by Downtime</div>
            <div className="panel-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={downtimeByMachine} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} min`} />
                  <YAxis type="category" dataKey="machine" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [`${v} min`, "Downtime"]} />
                  <Bar dataKey="minutes" fill="#ef4444" radius={[0, 2, 2, 0]} name="Downtime (min)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* PM Compliance */}
      {tab === "pm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total PM WOs</div>
              <div className="kpi-value">{pmCompliance.total}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Completed</div>
              <div className="kpi-value">{pmCompliance.completed}</div>
            </div>
            <div className="kpi-card" style={{ borderTop: `3px solid ${pmCompliance.rate >= 80 ? "#10b981" : "#ef4444"}` }}>
              <div className="kpi-label">Completion Rate</div>
              <div className="kpi-value" style={{ color: pmCompliance.rate >= 80 ? "#10b981" : "#ef4444" }}>{pmCompliance.rate}%</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">On-Time Rate</div>
              <div className="kpi-value" style={{ color: pmCompliance.otRate >= 80 ? "#10b981" : "#f59e0b" }}>{pmCompliance.otRate}%</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Preventive Maintenance Work Orders</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>WO #</th>
                    <th>Title</th>
                    <th>Machine</th>
                    <th>Scheduled</th>
                    <th>Completed</th>
                    <th>On Time?</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.filter((w) => w.type === "PREVENTIVE").length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No PM work orders</td></tr>
                  ) : workOrders.filter((w) => w.type === "PREVENTIVE").map((w) => {
                    const onTime = w.completedAt != null && w.completedAt <= w.scheduledDate;
                    return (
                      <tr key={w.id}>
                        <td><code style={{ fontSize: 11 }}>{w.woNumber}</code></td>
                        <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</td>
                        <td style={{ fontSize: 12 }}>{w.machineCode}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(w.scheduledDate)}</td>
                        <td style={{ fontSize: 12 }}>{w.completedAt ? fmtDate(w.completedAt) : "—"}</td>
                        <td>
                          {w.status === "COMPLETE" ? (
                            <span className="tag" style={{ background: onTime ? "#10b98120" : "#ef444420", color: onTime ? "#10b981" : "#ef4444", fontSize: 11 }}>
                              {onTime ? "Yes" : "Late"}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ fontSize: 11 }}>{w.status.replace("_", " ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Spare Parts */}
      {tab === "parts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Usage Events</div>
              <div className="kpi-value">{usages.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Parts Cost</div>
              <div className="kpi-value">{fmtCost(usages.reduce((s, u) => s + (u.totalCostUsd ?? 0), 0))}</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Top 10 Parts by Cost</div>
            <div className="panel-body">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={partsCostByItem} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtCost(v), "Cost"]} />
                  <Bar dataKey="cost" fill="#6366f1" radius={[0, 2, 2, 0]} name="Cost (USD)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>WO #</th>
                    <th>Machine</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usages.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No usage records</td></tr>
                  ) : usages.slice(0, 100).map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                      <td><code style={{ fontSize: 11 }}>{u.woNumber}</code></td>
                      <td style={{ fontSize: 12 }}>{u.machineCode}</td>
                      <td style={{ fontSize: 12 }}>{u.itemName}</td>
                      <td style={{ fontSize: 12 }}>{u.quantityUsed}</td>
                      <td style={{ fontSize: 12 }}>{fmtCost(u.totalCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cost Report */}
      {tab === "cost" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total Cost (180d)</div>
              <div className="kpi-value">{fmtCost(workOrders.reduce((s, w) => s + (w.totalCostUsd ?? 0), 0))}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Parts Cost</div>
              <div className="kpi-value">{fmtCost(usages.reduce((s, u) => s + (u.totalCostUsd ?? 0), 0))}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Completed WOs</div>
              <div className="kpi-value">{workOrders.filter((w) => w.status === "COMPLETE").length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg Cost / WO</div>
              <div className="kpi-value">
                {(() => {
                  const completed = workOrders.filter((w) => w.totalCostUsd != null && w.totalCostUsd > 0);
                  if (!completed.length) return "—";
                  return fmtCost(completed.reduce((s, w) => s + (w.totalCostUsd ?? 0), 0) / completed.length);
                })()}
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Monthly Cost Breakdown (6 months)</div>
            <div className="panel-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={costTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [fmtCost(v), "Total Cost"]} />
                  <Bar dataKey="cost" fill="#6366f1" radius={[2, 2, 0, 0]} name="Cost (USD)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">Top Machines by Cost</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>WOs</th>
                    <th>Total Cost</th>
                    <th>Avg Cost / WO</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const map: Record<string, { code: string; name: string; count: number; cost: number }> = {};
                    workOrders.forEach((w) => {
                      if (!map[w.machineCode]) map[w.machineCode] = { code: w.machineCode, name: w.machineName, count: 0, cost: 0 };
                      map[w.machineCode].count += 1;
                      map[w.machineCode].cost += w.totalCostUsd ?? 0;
                    });
                    return Object.values(map).sort((a, b) => b.cost - a.cost).slice(0, 10).map((m) => (
                      <tr key={m.code}>
                        <td style={{ fontWeight: 500 }}>{m.code} — {m.name}</td>
                        <td style={{ textAlign: "center" }}>{m.count}</td>
                        <td>{fmtCost(m.cost)}</td>
                        <td>{m.count > 0 ? fmtCost(m.cost / m.count) : "—"}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
