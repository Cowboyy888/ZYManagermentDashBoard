"use client";

import { useState, useMemo, useCallback } from "react";
import { createNCR, updateNCRStatus } from "@/actions/quality";

interface NCR {
  id: number; ncrNumber: string; inspectionId: number | null; inspectionNumber: string | null;
  defectType: string; defectDescription: string | null; severity: string; rootCause: string | null;
  status: string; responsibleId: number | null; responsibleName: string | null;
  dueDate: string | null; closedAt: string | null; createdBy: string; capaCount: number; createdAt: string;
}

interface Inspection { id: number; inspectionNumber: string; type: string }
interface Employee { id: number; nameEn: string }

interface Props {
  ncrs: NCR[];
  inspections: Inspection[];
  employees: Employee[];
  canWrite: boolean;
  canApprove: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  MAJOR: "#f97316",
  MINOR: "#eab308",
  OBSERVATION: "#6b7280",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#ef4444",
  UNDER_REVIEW: "#f97316",
  CORRECTIVE_ACTION: "#3b82f6",
  CLOSED: "#22c55e",
  CANCELLED: "#6b7280",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function NCRManager({ ncrs: initial, inspections, employees, canWrite, canApprove }: Props) {
  const [ncrs, setNcrs] = useState(initial);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    inspectionId: "", defectType: "", defectDescription: "",
    severity: "MAJOR", rootCause: "", responsibleId: "", dueDate: "",
  });

  const filtered = useMemo(() => ncrs.filter((n) => {
    if (severityFilter !== "ALL" && n.severity !== severityFilter) return false;
    if (statusFilter !== "ALL" && n.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.ncrNumber.toLowerCase().includes(q) || n.defectType.toLowerCase().includes(q) || (n.defectDescription ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [ncrs, severityFilter, statusFilter, search]);

  const viewNCR = useMemo(() => viewId ? ncrs.find((n) => n.id === viewId) ?? null : null, [ncrs, viewId]);

  const handleCreate = useCallback(async () => {
    if (!form.defectType.trim()) { setError("Defect type is required"); return; }
    setSaving(true);
    setError("");
    const res = await createNCR({
      inspectionId: form.inspectionId || null,
      defectType: form.defectType,
      defectDescription: form.defectDescription || null,
      severity: form.severity,
      rootCause: form.rootCause || null,
      responsibleId: form.responsibleId || null,
      dueDate: form.dueDate || null,
    });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data;
    const shaped: NCR = {
      id: d.id, ncrNumber: d.ncrNumber,
      inspectionId: d.inspectionId,
      inspectionNumber: inspections.find((i) => i.id === d.inspectionId)?.inspectionNumber ?? null,
      defectType: d.defectType, defectDescription: d.defectDescription,
      severity: d.severity, rootCause: d.rootCause,
      status: d.status as string,
      responsibleId: d.responsibleId,
      responsibleName: employees.find((e) => e.id === d.responsibleId)?.nameEn ?? null,
      dueDate: d.dueDate ? (d.dueDate as Date).toISOString() : null,
      closedAt: d.closedAt?.toISOString() ?? null,
      createdBy: "You",
      capaCount: 0,
      createdAt: d.createdAt.toISOString(),
    };
    setNcrs((prev) => [shaped, ...prev]);
    setShowCreate(false);
    setForm({ inspectionId: "", defectType: "", defectDescription: "", severity: "MAJOR", rootCause: "", responsibleId: "", dueDate: "" });
  }, [form, inspections, employees]);

  const handleStatusChange = useCallback(async (id: number, status: string) => {
    const res = await updateNCRStatus({ id, status });
    if ("error" in res) return;
    const d = res.data;
    setNcrs((prev) => prev.map((n) => n.id === id ? { ...n, status: d.status as string, closedAt: d.closedAt?.toISOString() ?? null } : n));
  }, []);

  const INPUT = { style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {["OPEN", "UNDER_REVIEW", "CORRECTIVE_ACTION", "CLOSED"].map((s) => {
          const count = ncrs.filter((n) => n.status === s).length;
          return (
            <div key={s} className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setStatusFilter(statusFilter === s ? "ALL" : s)}>
              <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{s.replace(/_/g, " ")}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLOR[s], marginTop: 4 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input {...INPUT} placeholder="Search NCRs..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT.style, width: 220 }} />
        <select {...INPUT} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ ...INPUT.style, width: 140 }}>
          <option value="ALL">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="MAJOR">Major</option>
          <option value="MINOR">Minor</option>
          <option value="OBSERVATION">Observation</option>
        </select>
        <select {...INPUT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...INPUT.style, width: 160 }}>
          <option value="ALL">All Status</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="CORRECTIVE_ACTION">Corrective Action</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {canWrite && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowCreate(true)}>
            + New NCR
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>New Non-Conformance Report</h2>
            {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Linked Inspection</span>
                <select {...INPUT} value={form.inspectionId} onChange={(e) => setForm((f) => ({ ...f, inspectionId: e.target.value }))}>
                  <option value="">— None —</option>
                  {inspections.map((i) => <option key={i.id} value={i.id}>{i.inspectionNumber} ({i.type.replace(/_/g, " ")})</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Severity *</span>
                <select {...INPUT} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                  <option value="CRITICAL">Critical</option>
                  <option value="MAJOR">Major</option>
                  <option value="MINOR">Minor</option>
                  <option value="OBSERVATION">Observation</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Defect Type *</span>
                <input {...INPUT} value={form.defectType} onChange={(e) => setForm((f) => ({ ...f, defectType: e.target.value }))} placeholder="e.g. Dimensional out of spec, Weld defect..." />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Defect Description</span>
                <textarea {...INPUT} rows={2} value={form.defectDescription} onChange={(e) => setForm((f) => ({ ...f, defectDescription: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Root Cause</span>
                <textarea {...INPUT} rows={2} value={form.rootCause} onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Responsible Person</span>
                <select {...INPUT} value={form.responsibleId} onChange={(e) => setForm((f) => ({ ...f, responsibleId: e.target.value }))}>
                  <option value="">— None —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Due Date</span>
                <input {...INPUT} type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create NCR"}</button>
              <button className="btn" onClick={() => { setShowCreate(false); setError(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewNCR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setViewId(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontFamily: "monospace" }}>{viewNCR.ncrNumber}</h2>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Created by {viewNCR.createdBy} • {fmt(viewNCR.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {viewNCR.status === "OPEN" && canApprove && (
                  <button className="btn btn-sm" style={{ background: "#f97316", color: "#fff" }} onClick={() => handleStatusChange(viewNCR.id, "UNDER_REVIEW")}>Review</button>
                )}
                {viewNCR.status === "CORRECTIVE_ACTION" && canApprove && (
                  <button className="btn btn-sm" style={{ background: "#22c55e", color: "#fff" }} onClick={() => handleStatusChange(viewNCR.id, "CLOSED")}>Close</button>
                )}
                {!["CLOSED", "CANCELLED"].includes(viewNCR.status) && canApprove && (
                  <button className="btn btn-sm" style={{ background: "var(--surface-2)", color: "var(--text-3)" }} onClick={() => handleStatusChange(viewNCR.id, "CANCELLED")}>Cancel</button>
                )}
                <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
              {[
                ["Status", <span key="s" className="tag" style={{ background: (STATUS_COLOR[viewNCR.status] ?? "#6b7280") + "20", color: STATUS_COLOR[viewNCR.status] ?? "#6b7280" }}>{viewNCR.status.replace(/_/g, " ")}</span>],
                ["Severity", <span key="sv" className="tag" style={{ background: (SEVERITY_COLOR[viewNCR.severity] ?? "#6b7280") + "20", color: SEVERITY_COLOR[viewNCR.severity] ?? "#6b7280" }}>{viewNCR.severity}</span>],
                ["Defect Type", viewNCR.defectType],
                ["Inspection", viewNCR.inspectionNumber ?? "—"],
                ["Responsible", viewNCR.responsibleName ?? "—"],
                ["Due Date", viewNCR.dueDate ? fmt(viewNCR.dueDate) : "—"],
                ["CAPAs", viewNCR.capaCount],
                ["Closed", viewNCR.closedAt ? fmt(viewNCR.closedAt) : "—"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{k}</div>
                  <div style={{ marginTop: 2 }}>{v as React.ReactNode}</div>
                </div>
              ))}
            </div>
            {viewNCR.defectDescription && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Description</div>
                <div style={{ marginTop: 4, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, fontSize: 13 }}>{viewNCR.defectDescription}</div>
              </div>
            )}
            {viewNCR.rootCause && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Root Cause</div>
                <div style={{ marginTop: 4, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, fontSize: 13 }}>{viewNCR.rootCause}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">Non-Conformance Reports ({filtered.length})</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>NCR #</th>
                <th>Defect Type</th>
                <th>Severity</th>
                <th>Inspection</th>
                <th>Responsible</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>CAPAs</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No NCRs found</td></tr>
              )}
              {filtered.map((n) => {
                const overdue = n.dueDate && !["CLOSED", "CANCELLED"].includes(n.status) && new Date(n.dueDate) < new Date();
                return (
                  <tr key={n.id} style={{ cursor: "pointer" }} onClick={() => setViewId(n.id)}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{n.ncrNumber}</td>
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.defectType}</td>
                    <td>
                      <span className="tag" style={{ background: (SEVERITY_COLOR[n.severity] ?? "#6b7280") + "20", color: SEVERITY_COLOR[n.severity] ?? "#6b7280" }}>
                        {n.severity}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{n.inspectionNumber ?? "—"}</td>
                    <td>{n.responsibleName ?? "—"}</td>
                    <td style={{ color: overdue ? "#ef4444" : "var(--text-3)", fontSize: 12, fontWeight: overdue ? 600 : 400 }}>
                      {n.dueDate ? fmt(n.dueDate) : "—"}
                    </td>
                    <td>
                      <span className="tag" style={{ background: (STATUS_COLOR[n.status] ?? "#6b7280") + "20", color: STATUS_COLOR[n.status] ?? "#6b7280" }}>
                        {n.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{n.capaCount > 0 ? <span className="tag" style={{ background: "#3b82f620", color: "#3b82f6" }}>{n.capaCount}</span> : "—"}</td>
                    <td style={{ color: "var(--text-3)", fontSize: 12 }}>{fmt(n.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
