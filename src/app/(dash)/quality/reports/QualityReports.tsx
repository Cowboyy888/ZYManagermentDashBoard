"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

interface Inspection {
  id: number; inspectionNumber: string; type: string; status: string;
  result: string | null; inspectionDate: string; sampleSize: number | null;
  defectCount: number | null; productDescription: string | null; batchNumber: string | null; orderCode: string | null;
}

interface NCR {
  id: number; ncrNumber: string; defectType: string; severity: string;
  status: string; createdAt: string; dueDate: string | null; closedAt: string | null;
}

interface CAPA {
  id: number; actionType: string; status: string;
  dueDate: string | null; completedAt: string | null; ncrSeverity: string; createdAt: string;
}

interface Certificate {
  id: number; certificateNumber: string; type: string; customerName: string | null; issuedDate: string;
}

interface Props {
  inspections: Inspection[];
  ncrs: NCR[];
  capas: CAPA[];
  certificates: Certificate[];
  canExport: boolean;
}

const TABS = ["Pass Rate Trend", "Inspection Summary", "NCR Analysis", "CAPA Status", "Certificates"];

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  MAJOR: "#f97316",
  MINOR: "#eab308",
  OBSERVATION: "#6b7280",
};

const PIE_COLORS = ["#22c55e", "#ef4444", "#f97316", "#3b82f6", "#8b5cf6", "#eab308"];

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function QualityReports({ inspections, ncrs, capas, certificates, canExport }: Props) {
  const [tab, setTab] = useState(0);

  // Pass rate trend — last 6 months
  const passRateTrend = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map((key) => {
      const month = inspections.filter((i) => monthKey(i.inspectionDate) === key);
      const passed = month.filter((i) => i.result === "PASS").length;
      const failed = month.filter((i) => i.result === "FAIL").length;
      const total = month.filter((i) => i.result !== null).length;
      return {
        month: monthLabel(key),
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        passed, failed, total,
      };
    });
  }, [inspections]);

  // Inspection by type
  const byType = useMemo(() => {
    const types: Record<string, { passed: number; failed: number; pending: number }> = {};
    for (const i of inspections) {
      if (!types[i.type]) types[i.type] = { passed: 0, failed: 0, pending: 0 };
      if (i.result === "PASS") types[i.type].passed++;
      else if (i.result === "FAIL") types[i.type].failed++;
      else types[i.type].pending++;
    }
    return Object.entries(types).map(([type, v]) => ({ type: type.replace(/_/g, " "), ...v }));
  }, [inspections]);

  // NCR by severity
  const ncrBySeverity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of ncrs) counts[n.severity] = (counts[n.severity] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [ncrs]);

  // NCR monthly trend
  const ncrTrend = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months.map((key) => ({
      month: monthLabel(key),
      open: ncrs.filter((n) => monthKey(n.createdAt) === key).length,
      closed: ncrs.filter((n) => n.closedAt && monthKey(n.closedAt) === key).length,
    }));
  }, [ncrs]);

  // CAPA status breakdown
  const capaByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of capas) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [capas]);

  // Cert by type
  const certByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of certificates) counts[c.type] = (counts[c.type] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [certificates]);

  const CHART_STYLE = { height: 220 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "8px 16px", fontSize: 13, fontWeight: tab === i ? 600 : 400,
            color: tab === i ? "var(--primary)" : "var(--text-3)",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: tab === i ? "2px solid var(--primary)" : "2px solid transparent",
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {/* Tab 0 — Pass Rate Trend */}
      {tab === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="kpi-card">
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>Total Inspections</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{inspections.length}</div>
            </div>
            <div className="kpi-card">
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>Overall Pass Rate</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#22c55e", marginTop: 4 }}>
                {inspections.filter((i) => i.result !== null).length > 0
                  ? `${Math.round((inspections.filter((i) => i.result === "PASS").length / inspections.filter((i) => i.result !== null).length) * 100)}%`
                  : "—"}
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>Failed Inspections</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#ef4444", marginTop: 4 }}>{inspections.filter((i) => i.result === "FAIL").length}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Pass Rate Trend (6 Months)</div>
            <div className="panel-body" style={CHART_STYLE}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={passRateTrend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Pass Rate"]} contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                  <Line type="monotone" dataKey="passRate" name="Pass Rate %" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Monthly Volume (Passed vs Failed)</div>
            <div className="panel-body" style={CHART_STYLE}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={passRateTrend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                  <Bar dataKey="passed" name="Passed" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="v" />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="v" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1 — Inspection Summary */}
      {tab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head">By Inspection Type</div>
              <div className="panel-body" style={CHART_STYLE}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: "var(--text-3)" }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                    <Bar dataKey="passed" name="Passed" fill="#22c55e" stackId="t" />
                    <Bar dataKey="failed" name="Failed" fill="#ef4444" stackId="t" />
                    <Bar dataKey="pending" name="Pending" fill="#eab308" stackId="t" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Recent Inspections</div>
              <div className="panel-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Inspection #</th><th>Type</th><th>Result</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {inspections.slice(0, 10).map((i) => (
                      <tr key={i.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{i.inspectionNumber}</td>
                        <td style={{ fontSize: 12 }}>{i.type.replace(/_/g, " ")}</td>
                        <td>
                          {i.result && (
                            <span className="tag" style={{ background: (i.result === "PASS" ? "#22c55e" : "#ef4444") + "20", color: i.result === "PASS" ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                              {i.result}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: "var(--text-3)" }}>{fmt(i.inspectionDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2 — NCR Analysis */}
      {tab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {["OPEN", "UNDER_REVIEW", "CORRECTIVE_ACTION", "CLOSED"].map((s, i) => {
              const colors = ["#ef4444", "#f97316", "#3b82f6", "#22c55e"];
              return (
                <div key={s} className="kpi-card">
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors[i], marginTop: 4 }}>{ncrs.filter((n) => n.status === s).length}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head">NCR by Severity</div>
              <div className="panel-body" style={CHART_STYLE}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ncrBySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                      {ncrBySeverity.map((entry, i) => (
                        <Cell key={i} fill={SEVERITY_COLOR[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Monthly NCR Trend</div>
              <div className="panel-body" style={CHART_STYLE}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ncrTrend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                    <Bar dataKey="open" name="Opened" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="closed" name="Closed" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Recent NCRs</div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>NCR #</th><th>Defect Type</th><th>Severity</th><th>Status</th><th>Due Date</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {ncrs.slice(0, 15).map((n) => {
                    const overdue = n.dueDate && !["CLOSED", "CANCELLED"].includes(n.status) && new Date(n.dueDate) < new Date();
                    return (
                      <tr key={n.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{n.ncrNumber}</td>
                        <td>{n.defectType}</td>
                        <td><span className="tag" style={{ background: (SEVERITY_COLOR[n.severity] ?? "#6b7280") + "20", color: SEVERITY_COLOR[n.severity] ?? "#6b7280" }}>{n.severity}</span></td>
                        <td><span className="tag" style={{ fontSize: 11 }}>{n.status.replace(/_/g, " ")}</span></td>
                        <td style={{ fontSize: 12, color: overdue ? "#ef4444" : "var(--text-3)", fontWeight: overdue ? 600 : 400 }}>{n.dueDate ? fmt(n.dueDate) : "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--text-3)" }}>{fmt(n.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3 — CAPA Status */}
      {tab === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head">CAPA by Status</div>
              <div className="panel-body" style={CHART_STYLE}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={capaByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                      {capaByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Overdue & Upcoming</div>
              <div className="panel-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>NCR</th><th>Action Type</th><th>Assigned To</th><th>Due Date</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {capas.filter((c) => !["COMPLETE", "VERIFIED", "CANCELLED"].includes(c.status)).slice(0, 10).map((c) => {
                      const overdue = c.dueDate && new Date(c.dueDate) < new Date();
                      return (
                        <tr key={c.id}>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>—</td>
                          <td style={{ fontSize: 12 }}>{c.actionType}</td>
                          <td style={{ fontSize: 12 }}>—</td>
                          <td style={{ fontSize: 12, color: overdue ? "#ef4444" : "var(--text-3)", fontWeight: overdue ? 600 : 400 }}>{c.dueDate ? fmt(c.dueDate) : "—"}</td>
                          <td><span className="tag" style={{ fontSize: 11 }}>{c.status.replace(/_/g, " ")}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4 — Certificates */}
      {tab === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="panel">
              <div className="panel-head">Certificates by Type</div>
              <div className="panel-body" style={CHART_STYLE}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={certByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                      {certByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">Recent Certificates</div>
              <div className="panel-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Certificate #</th><th>Type</th><th>Customer</th><th>Issued</th></tr>
                  </thead>
                  <tbody>
                    {certificates.slice(0, 15).map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.certificateNumber}</td>
                        <td style={{ fontSize: 12 }}>{c.type.replace(/_/g, " ")}</td>
                        <td>{c.customerName ?? "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--text-3)" }}>{fmt(c.issuedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
