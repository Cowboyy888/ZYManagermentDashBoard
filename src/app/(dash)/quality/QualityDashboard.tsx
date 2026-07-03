"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Summary {
  totalInspections: number;
  passCount: number;
  failCount: number;
  reworkCount: number;
  passRate: number | null;
  openNCRs: number;
  criticalNCRs: number;
  overdueCapas: number;
  certThisMonth: number;
  trend: { month: string; pass: number; fail: number; rework: number }[];
  recentInspections: {
    id: number; inspectionNumber: string; type: string; status: string;
    result: string | null; inspectorName: string | null; inspectionDate: string;
    orderCode: string | null; sampleSize: number | null; defectCount: number | null;
  }[];
  recentNCRs: {
    id: number; ncrNumber: string; defectType: string; severity: string;
    status: string; responsibleName: string | null; dueDate: string | null; createdAt: string;
  }[];
}

interface Props {
  summary: Summary;
  canManage: boolean;
  canApprove: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  MAJOR: "#f97316",
  MINOR: "#eab308",
  OBSERVATION: "#6b7280",
};

const STATUS_COLOR: Record<string, string> = {
  PASS: "#22c55e",
  FAIL: "#ef4444",
  PENDING: "#eab308",
  OPEN: "#ef4444",
  UNDER_REVIEW: "#f97316",
  CORRECTIVE_ACTION: "#3b82f6",
  CLOSED: "#22c55e",
  CANCELLED: "#6b7280",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function QualityDashboard({ summary, canManage, canApprove }: Props) {
  const passRatePct = summary.passRate !== null ? summary.passRate.toFixed(1) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        <KPI label="Pass Rate" value={passRatePct !== "—" ? `${passRatePct}%` : "—"} sub={`${summary.passCount} / ${summary.totalInspections}`} color="#22c55e" />
        <KPI label="Failed Inspections" value={summary.failCount} sub="this month" color="#ef4444" />
        <KPI label="Open NCRs" value={summary.openNCRs} sub="non-conformances" color="#f97316" />
        <KPI label="Overdue CAPAs" value={summary.overdueCapas} sub="corrective actions" color={summary.overdueCapas > 0 ? "#ef4444" : "#22c55e"} />
        <KPI label="Rework Items" value={summary.reworkCount} sub="this month" color="#3b82f6" />
        <KPI label="Certificates" value={summary.certThisMonth} sub="issued this month" color="#8b5cf6" />
      </div>

      {/* Chart + Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Monthly trend */}
        <div className="panel">
          <div className="panel-head">Monthly Inspection Trend</div>
          <div className="panel-body" style={{ height: 220 }}>
            {summary.trend.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)", fontSize: 13 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <Tooltip contentStyle={{ fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }} />
                  <Bar dataKey="pass" name="Passed" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="fail" name="Failed" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent NCRs */}
        <div className="panel">
          <div className="panel-head">Recent Non-Conformances</div>
          <div className="panel-body" style={{ padding: 0 }}>
            {summary.recentNCRs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No NCRs</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>NCR #</th>
                    <th>Defect</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentNCRs.map((n) => (
                    <tr key={n.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{n.ncrNumber}</td>
                      <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.defectType}</td>
                      <td>
                        <span className="tag" style={{ background: SEVERITY_COLOR[n.severity] + "20", color: SEVERITY_COLOR[n.severity] }}>
                          {n.severity}
                        </span>
                      </td>
                      <td>
                        <span className="tag" style={{ background: (STATUS_COLOR[n.status] ?? "#6b7280") + "20", color: STATUS_COLOR[n.status] ?? "#6b7280" }}>
                          {n.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-3)", fontSize: 12 }}>{fmt(n.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="panel">
        <div className="panel-head">Recent Inspections</div>
        <div className="panel-body" style={{ padding: 0 }}>
          {summary.recentInspections.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No inspections found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Inspection #</th>
                  <th>Type</th>
                  <th>Inspector</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentInspections.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{i.inspectionNumber}</td>
                    <td>{i.type.replace(/_/g, " ")}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.inspectorName ?? "—"}</td>
                    <td>
                      <span className="tag" style={{ background: "var(--surface-2)", color: "var(--text-2)", fontSize: 11 }}>
                        {i.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      {i.result && (
                        <span className="tag" style={{ background: (STATUS_COLOR[i.result] ?? "#6b7280") + "20", color: STATUS_COLOR[i.result] ?? "#6b7280" }}>
                          {i.result}
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: 12 }}>{fmt(i.inspectionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-3)" }}>
        Navigate to Inspections, NCR, CAPA, or Certificates for full management.
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="kpi-card">
      <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
