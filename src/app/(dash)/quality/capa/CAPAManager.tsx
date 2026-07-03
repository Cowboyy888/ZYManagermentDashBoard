"use client";

import { useState, useMemo, useCallback } from "react";
import { createCAPA, updateCAPAStatus } from "@/actions/quality";

interface CAPA {
  id: number; ncrId: number; ncrNumber: string; defectType: string; ncrSeverity: string;
  actionType: string; description: string; assignedToId: string | null; assignedToName: string | null;
  dueDate: string | null; completedAt: string | null; status: string; notes: string | null; createdAt: string;
}

interface OpenNCR { id: number; ncrNumber: string; defectType: string }
interface User { id: string; name: string }

interface Props {
  capas: CAPA[];
  openNCRs: OpenNCR[];
  users: User[];
  canWrite: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#ef4444",
  IN_PROGRESS: "#3b82f6",
  COMPLETE: "#22c55e",
  VERIFIED: "#8b5cf6",
  CANCELLED: "#6b7280",
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  MAJOR: "#f97316",
  MINOR: "#eab308",
  OBSERVATION: "#6b7280",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CAPAManager({ capas: initial, openNCRs, users, canWrite }: Props) {
  const [capas, setCapas] = useState(initial);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    ncrId: "", actionType: "CORRECTIVE", description: "", assignedToId: "", dueDate: "", notes: "",
  });

  const filtered = useMemo(() => capas.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.ncrNumber.toLowerCase().includes(q) || c.defectType.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    }
    return true;
  }), [capas, statusFilter, search]);

  const handleCreate = useCallback(async () => {
    if (!form.ncrId) { setError("NCR is required"); return; }
    if (!form.description.trim()) { setError("Description is required"); return; }
    setSaving(true);
    setError("");
    const res = await createCAPA({
      ncrId: form.ncrId,
      actionType: form.actionType,
      description: form.description,
      assignedToId: form.assignedToId || null,
      dueDate: form.dueDate || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data;
    const ncr = openNCRs.find((n) => n.id === d.ncrId);
    const shaped: CAPA = {
      id: d.id,
      ncrId: d.ncrId,
      ncrNumber: ncr?.ncrNumber ?? "—",
      defectType: ncr?.defectType ?? "—",
      ncrSeverity: "MAJOR",
      actionType: d.actionType,
      description: d.description,
      assignedToId: d.assignedToId,
      assignedToName: users.find((u) => u.id === d.assignedToId)?.name ?? null,
      dueDate: d.dueDate ? (d.dueDate as Date).toISOString() : null,
      completedAt: d.completedAt?.toISOString() ?? null,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
    };
    setCapas((prev) => [shaped, ...prev]);
    setShowCreate(false);
    setForm({ ncrId: "", actionType: "CORRECTIVE", description: "", assignedToId: "", dueDate: "", notes: "" });
  }, [form, openNCRs, users]);

  const handleStatusChange = useCallback(async (id: number, status: "OPEN" | "IN_PROGRESS" | "COMPLETE") => {
    const res = await updateCAPAStatus({ id, status });
    if ("error" in res) return;
    const d = res.data;
    setCapas((prev) => prev.map((c) => c.id === id ? { ...c, status: d.status, completedAt: d.completedAt?.toISOString() ?? null } : c));
  }, []);

  const INPUT = { style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 } };

  const counts = useMemo(() => ({
    open: capas.filter((c) => c.status === "OPEN").length,
    inProgress: capas.filter((c) => c.status === "IN_PROGRESS").length,
    complete: capas.filter((c) => c.status === "COMPLETE").length,
    overdue: capas.filter((c) => c.dueDate && !["COMPLETE", "VERIFIED", "CANCELLED"].includes(c.status) && new Date(c.dueDate) < new Date()).length,
  }), [capas]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div className="kpi-card"><div style={{ fontSize: 11, color: "var(--text-3)" }}>Open</div><div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444", marginTop: 4 }}>{counts.open}</div></div>
        <div className="kpi-card"><div style={{ fontSize: 11, color: "var(--text-3)" }}>In Progress</div><div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", marginTop: 4 }}>{counts.inProgress}</div></div>
        <div className="kpi-card"><div style={{ fontSize: 11, color: "var(--text-3)" }}>Complete</div><div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e", marginTop: 4 }}>{counts.complete}</div></div>
        <div className="kpi-card"><div style={{ fontSize: 11, color: "var(--text-3)" }}>Overdue</div><div style={{ fontSize: 24, fontWeight: 700, color: counts.overdue > 0 ? "#ef4444" : "#22c55e", marginTop: 4 }}>{counts.overdue}</div></div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input {...INPUT} placeholder="Search CAPAs..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT.style, width: 220 }} />
        <select {...INPUT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...INPUT.style, width: 160 }}>
          <option value="ALL">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETE">Complete</option>
          <option value="VERIFIED">Verified</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {canWrite && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowCreate(true)}>
            + New CAPA
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>New Corrective / Preventive Action</h2>
            {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>NCR *</span>
                <select {...INPUT} value={form.ncrId} onChange={(e) => setForm((f) => ({ ...f, ncrId: e.target.value }))}>
                  <option value="">— Select NCR —</option>
                  {openNCRs.map((n) => <option key={n.id} value={n.id}>{n.ncrNumber} — {n.defectType}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Action Type *</span>
                <select {...INPUT} value={form.actionType} onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}>
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="PREVENTIVE">Preventive</option>
                  <option value="IMPROVEMENT">Improvement</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Description *</span>
                <textarea {...INPUT} rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the action to be taken..." />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>Assigned To</span>
                  <select {...INPUT} value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}>
                    <option value="">— None —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>Due Date</span>
                  <input {...INPUT} type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Notes</span>
                <textarea {...INPUT} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create CAPA"}</button>
              <button className="btn" onClick={() => { setShowCreate(false); setError(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">CAPA Actions ({filtered.length})</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>NCR #</th>
                <th>Defect</th>
                <th>Severity</th>
                <th>Action Type</th>
                <th>Description</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No CAPA actions found</td></tr>
              )}
              {filtered.map((c) => {
                const overdue = c.dueDate && !["COMPLETE", "VERIFIED", "CANCELLED"].includes(c.status) && new Date(c.dueDate) < new Date();
                return (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.ncrNumber}</td>
                    <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.defectType}</td>
                    <td>
                      <span className="tag" style={{ background: (SEVERITY_COLOR[c.ncrSeverity] ?? "#6b7280") + "20", color: SEVERITY_COLOR[c.ncrSeverity] ?? "#6b7280" }}>
                        {c.ncrSeverity}
                      </span>
                    </td>
                    <td>{c.actionType}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</td>
                    <td>{c.assignedToName ?? "—"}</td>
                    <td style={{ color: overdue ? "#ef4444" : "var(--text-3)", fontSize: 12, fontWeight: overdue ? 600 : 400 }}>
                      {c.dueDate ? fmt(c.dueDate) : "—"}
                    </td>
                    <td>
                      <span className="tag" style={{ background: (STATUS_COLOR[c.status] ?? "#6b7280") + "20", color: STATUS_COLOR[c.status] ?? "#6b7280" }}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {canWrite && c.status === "OPEN" && (
                        <button className="btn btn-sm" style={{ fontSize: 11, marginRight: 4, background: "#3b82f620", color: "#3b82f6" }} onClick={() => handleStatusChange(c.id, "IN_PROGRESS")}>Start</button>
                      )}
                      {canWrite && c.status === "IN_PROGRESS" && (
                        <button className="btn btn-sm" style={{ fontSize: 11, background: "#22c55e20", color: "#22c55e" }} onClick={() => handleStatusChange(c.id, "COMPLETE")}>Complete</button>
                      )}
                    </td>
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
