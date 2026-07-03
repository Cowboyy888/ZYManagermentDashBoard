"use client";

import { useState, useTransition } from "react";
import { createSchedule, updateSchedule, generateWorkOrderFromSchedule } from "@/actions/maintenance";

interface Schedule {
  id: number;
  title: string;
  description: string | null;
  frequency: string;
  machineId: number;
  machineCode: string;
  machineName: string;
  assignedToId: number | null;
  assignedToName: string | null;
  nextDueDate: string;
  lastCompletedAt: string | null;
  estimatedHours: number | null;
  active: boolean;
  workOrderCount: number;
  createdBy: string | null;
  createdAt: string;
}

interface Machine { id: number; code: string; name: string }
interface Employee { id: number; nameEn: string }

interface Props {
  schedules: Schedule[];
  machines: Machine[];
  employees: Employee[];
  canWrite: boolean;
}

const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];
const FREQ_COLORS: Record<string, string> = {
  DAILY: "#6366f1", WEEKLY: "#10b981", MONTHLY: "#f59e0b", QUARTERLY: "#f97316", YEARLY: "#ef4444",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(nextDueDate: string) {
  return new Date(nextDueDate) < new Date();
}

export function SchedulesManager({ schedules, machines, employees, canWrite }: Props) {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [search, setSearch] = useState("");
  const [freqFilter, setFreqFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("active");
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const filtered = schedules.filter((s) => {
    const matchSearch = !search || `${s.title} ${s.machineCode} ${s.machineName}`.toLowerCase().includes(search.toLowerCase());
    const matchFreq = freqFilter === "ALL" || s.frequency === freqFilter;
    const matchActive = activeFilter === "all" || (activeFilter === "active" ? s.active : !s.active);
    return matchSearch && matchFreq && matchActive;
  });

  const editSchedule = editId !== null ? schedules.find((s) => s.id === editId) : null;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createSchedule({
        title: fd.get("title") as string,
        description: fd.get("description") as string || null,
        frequency: fd.get("frequency") as string,
        machineId: Number(fd.get("machineId")),
        assignedToId: fd.get("assignedToId") ? Number(fd.get("assignedToId")) : null,
        nextDueDate: fd.get("nextDueDate") as string,
        estimatedHours: fd.get("estimatedHours") ? Number(fd.get("estimatedHours")) : null,
      });
      if ("error" in res) { setError(res.error); } else { setTab("list"); setError(""); }
    });
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editSchedule) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSchedule({
        id: editSchedule.id,
        title: fd.get("title") as string,
        description: fd.get("description") as string || null,
        frequency: fd.get("frequency") as string,
        assignedToId: fd.get("assignedToId") ? Number(fd.get("assignedToId")) : null,
        nextDueDate: fd.get("nextDueDate") as string,
        estimatedHours: fd.get("estimatedHours") ? Number(fd.get("estimatedHours")) : null,
        active: fd.get("active") === "true",
      });
      if ("error" in res) { setError(res.error); } else { setEditId(null); setError(""); }
    });
  }

  function handleGenerateWO(id: number) {
    setGeneratingId(id);
    startTransition(async () => {
      const res = await generateWorkOrderFromSchedule(id);
      setGeneratingId(null);
      if ("error" in res) setError(res.error);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {tab === "list" && (
          <>
            <input className="input" placeholder="Search title, machine..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
            <select className="input" value={freqFilter} onChange={(e) => setFreqFilter(e.target.value)} style={{ width: 150 }}>
              <option value="ALL">All Frequencies</option>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className="input" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={{ width: 130 }}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} schedules</span>
          </>
        )}
        <div style={{ marginLeft: "auto" }}>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => { setTab(tab === "list" ? "create" : "list"); setError(""); }}>
              {tab === "list" ? "+ New Schedule" : "← Back to List"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Create Form */}
      {tab === "create" && (
        <div className="panel">
          <div className="panel-head">New PM Schedule</div>
          <form className="panel-body" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Title *</span>
                <input className="input" name="title" required placeholder="e.g. Monthly lubrication check" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Machine *</span>
                <select className="input" name="machineId" required>
                  <option value="">Select machine</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Frequency *</span>
                <select className="input" name="frequency" required>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Next Due Date *</span>
                <input className="input" type="date" name="nextDueDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Est. Hours</span>
                <input className="input" type="number" name="estimatedHours" step="0.5" min="0" placeholder="0.0" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Assign Technician</span>
                <select className="input" name="assignedToId">
                  <option value="">— Unassigned —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Description / Checklist</span>
                <textarea className="input" name="description" rows={3} placeholder="Steps, checks, required tools..." />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => { setTab("list"); setError(""); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Creating…" : "Create Schedule"}</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {tab === "list" && (
        <div className="panel">
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Machine</th>
                  <th>Frequency</th>
                  <th>Next Due</th>
                  <th>Last Completed</th>
                  <th>Technician</th>
                  <th>Est. Hrs</th>
                  <th>WOs</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No schedules found</td></tr>
                ) : filtered.map((s) => {
                  const overdue = isOverdue(s.nextDueDate) && s.active;
                  return (
                    <tr key={s.id} style={{ background: overdue ? "var(--red-bg)" : undefined }}>
                      <td style={{ fontWeight: 500 }}>{s.title}</td>
                      <td style={{ fontSize: 12 }}>{s.machineCode} — {s.machineName}</td>
                      <td>
                        <span className="tag" style={{ background: (FREQ_COLORS[s.frequency] ?? "#94a3b8") + "20", color: FREQ_COLORS[s.frequency] ?? "#94a3b8", fontSize: 11 }}>
                          {s.frequency}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: overdue ? "var(--red)" : undefined, fontWeight: overdue ? 600 : undefined }}>
                        {fmtDate(s.nextDueDate)} {overdue && "⚠"}
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(s.lastCompletedAt)}</td>
                      <td style={{ fontSize: 12 }}>{s.assignedToName ?? "—"}</td>
                      <td style={{ textAlign: "center", fontSize: 12 }}>{s.estimatedHours ?? "—"}</td>
                      <td style={{ textAlign: "center" }}>{s.workOrderCount}</td>
                      <td>
                        <span className="tag" style={{ background: s.active ? "#10b98120" : "#94a3b820", color: s.active ? "#10b981" : "#94a3b8", fontSize: 11 }}>
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {canWrite && (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={() => setEditId(s.id)}>Edit</button>
                              <button
                                className="btn btn-sm"
                                style={{ fontSize: 10 }}
                                onClick={() => handleGenerateWO(s.id)}
                                disabled={isPending && generatingId === s.id}
                              >
                                {generatingId === s.id && isPending ? "…" : "Gen WO"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editSchedule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 520, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="panel-head">Edit Schedule: {editSchedule.title}</div>
            <form className="panel-body" onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Title *</span>
                  <input className="input" name="title" required defaultValue={editSchedule.title} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Frequency *</span>
                  <select className="input" name="frequency" required defaultValue={editSchedule.frequency}>
                    {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Next Due Date *</span>
                  <input className="input" type="date" name="nextDueDate" required defaultValue={editSchedule.nextDueDate.slice(0, 10)} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Est. Hours</span>
                  <input className="input" type="number" name="estimatedHours" step="0.5" min="0" defaultValue={editSchedule.estimatedHours ?? ""} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Status</span>
                  <select className="input" name="active" defaultValue={editSchedule.active ? "true" : "false"}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Assign Technician</span>
                  <select className="input" name="assignedToId" defaultValue={editSchedule.assignedToId ?? ""}>
                    <option value="">— Unassigned —</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Description / Checklist</span>
                  <textarea className="input" name="description" rows={3} defaultValue={editSchedule.description ?? ""} />
                </label>
              </div>
              {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setEditId(null); setError(""); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
