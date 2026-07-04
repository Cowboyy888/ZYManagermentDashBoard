"use client";
import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeptRow } from "@/actions/departments";
import {
  createDepartment, updateDepartment, deleteDepartment, archiveDepartment,
} from "@/actions/departments";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { fmtDate } from "@/lib/utils";

type Employee = { id: number; nameEn: string; nameKh: string };

interface Props {
  departments: DeptRow[];
  employees: Employee[];
  canEdit:   boolean;
  canDelete: boolean;
}

type StatusTab = "active" | "archived" | "all";

// ── Inline form ─────────────────────────────────────────────────────────────

function DeptForm({
  editing, employees, onDone,
}: { editing?: DeptRow; employees: Employee[]; onDone: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName]     = useState(editing?.name        ?? "");
  const [nameKh, setNameKh] = useState(editing?.nameKh      ?? "");
  const [nameZh, setNameZh] = useState(editing?.nameZh      ?? "");
  const [code, setCode]     = useState(editing?.code        ?? "");
  const [desc, setDesc]     = useState(editing?.description ?? "");
  const [managerId, setManagerId] = useState<string>(String(editing?.managerId ?? ""));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    const payload = {
      name,
      nameKh:      nameKh || null,
      nameZh:      nameZh || null,
      code:        code   || null,
      description: desc   || null,
      managerId:   managerId ? Number(managerId) : null,
    };
    const res = editing
      ? await updateDepartment(editing.id, payload)
      : await createDepartment(payload);
    setSaving(false);
    if (!res.ok) { setErr("error" in res ? res.error : "Save failed"); return; }
    startTransition(() => { router.refresh(); onDone(); });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px",
    border: "1px solid var(--border)", borderRadius: 8,
    fontSize: 13, background: "var(--surface)", color: "var(--text)",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <Alert level="error" message={err} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 12 }}>
        <div>
          <label style={labelStyle}>Name <span style={{ color: "var(--red)" }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="e.g. Wire Drawing" />
        </div>
        <div>
          <label style={labelStyle}>Khmer Name</label>
          <input value={nameKh} onChange={e => setNameKh(e.target.value)} style={inputStyle} placeholder="ខ្មែរ" />
        </div>
        <div>
          <label style={labelStyle}>Code</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={inputStyle} placeholder="WD" maxLength={20} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Chinese Name</label>
          <input value={nameZh} onChange={e => setNameZh(e.target.value)} style={inputStyle} placeholder="中文" />
        </div>
        <div>
          <label style={labelStyle}>Manager</label>
          <select value={managerId} onChange={e => setManagerId(e.target.value)} style={inputStyle}>
            <option value="">— None —</option>
            {employees.map(emp => (
              <option key={emp.id} value={String(emp.id)}>
                {emp.nameEn} ({emp.nameKh})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={desc} onChange={e => setDesc(e.target.value)}
          rows={2} style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Optional description…"
        />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button type="submit" loading={saving}>
          {editing ? "Save Changes" : "Create Department"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main client ──────────────────────────────────────────────────────────────

export function DepartmentsClient({ departments, employees, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [statusTab, setStatusTab]   = useState<StatusTab>("active");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [editingDept, setEditingDept] = useState<DeptRow | null>(null);
  const [actionErr, setActionErr]   = useState<string | Record<number, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return departments
      .filter(d =>
        statusTab === "all"      ? true :
        statusTab === "active"   ? d.active :
                                   !d.active
      )
      .filter(d =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.code?.toLowerCase() ?? "").includes(q) ||
        (d.managerName?.toLowerCase() ?? "").includes(q)
      );
  }, [departments, statusTab, search]);

  const counts = useMemo(() => ({
    active:   departments.filter(d => d.active).length,
    archived: departments.filter(d => !d.active).length,
    all:      departments.length,
  }), [departments]);

  function getErr(id: number): string {
    if (typeof actionErr === "string") return "";
    return (actionErr as Record<number, string>)[id] ?? "";
  }
  function setRowErr(id: number, msg: string) {
    setActionErr(prev => ({ ...(typeof prev === "object" ? prev : {}), [id]: msg }));
  }

  async function handleArchive(dept: DeptRow) {
    setRowErr(dept.id, "");
    const res = await archiveDepartment(dept.id, !dept.active);
    if (!res.ok) { setRowErr(dept.id, "error" in res ? res.error : "Failed"); return; }
    startTransition(() => router.refresh());
  }

  async function handleDelete(dept: DeptRow) {
    if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
    setRowErr(dept.id, "");
    const res = await deleteDepartment(dept.id);
    if (!res.ok) { setRowErr(dept.id, "error" in res ? res.error : "Failed"); return; }
    startTransition(() => router.refresh());
  }

  function openCreate() { setEditingDept(null); setShowForm(true); }
  function openEdit(d: DeptRow) { setEditingDept(d); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditingDept(null); }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 500,
    background: active ? "var(--steel)" : "var(--surface)",
    color: active ? "#fff" : "var(--text-2)",
  });
  const countBadge = (n: number, active: boolean) => (
    <span style={{
      marginLeft: 5, fontSize: 11,
      background: active ? "rgba(255,255,255,0.25)" : "var(--surface-2)",
      borderRadius: 10, padding: "0 5px",
    }}>{n}</span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Inline form panel */}
      {showForm && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {editingDept ? "Edit Department" : "New Department"}
            </h2>
            <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18 }}>✕</button>
          </div>
          <DeptForm editing={editingDept ?? undefined} employees={employees} onDone={closeForm} />
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            {(["active", "archived", "all"] as StatusTab[]).map((t, i) => (
              <button key={t} onClick={() => setStatusTab(t)} style={{
                ...tabStyle(statusTab === t),
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
              }}>
                {t === "active" ? "Active" : t === "archived" ? "Archived" : "All"}
                {countBadge(counts[t], statusTab === t)}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, manager…"
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
              fontSize: 13, background: "var(--surface)", color: "var(--text)", width: 220,
            }}
          />
        </div>
        {canEdit && !showForm && (
          <Button onClick={openCreate}>
            + Add Department
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          borderRadius: 10, border: "1.5px dashed var(--border)",
          padding: "48px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
        }}>
          {search ? "No departments match your search." : "No departments yet."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Name / Code", "Description", "Manager", "Employees", "Status", "Created", ""].map(h => (
                  <th key={h} style={{
                    padding: "9px 14px", textAlign: "left",
                    fontWeight: 600, fontSize: 11, textTransform: "uppercase",
                    letterSpacing: "0.04em", color: "var(--text-3)",
                    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <React.Fragment key={d.id}>
                  <tr style={{ borderBottom: "1px solid var(--border)" }} className="dept-row-hover">
                    <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 6 }}>
                        {d.code && (
                          <span style={{
                            display: "inline-block", padding: "0 6px", borderRadius: 4,
                            background: "var(--blue-bg)", color: "var(--blue)",
                            fontWeight: 700, fontSize: 11,
                          }}>{d.code}</span>
                        )}
                        {d.nameKh && <span>{d.nameKh}</span>}
                        {d.nameZh && <span>{d.nameZh}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", verticalAlign: "middle", maxWidth: 220 }}>
                      <span style={{ color: "var(--text-2)", fontSize: 12 }}>{d.description || "—"}</span>
                    </td>
                    <td style={{ padding: "11px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      {d.managerName
                        ? <span style={{ color: "var(--text)" }}>{d.managerName}</span>
                        : <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", verticalAlign: "middle", textAlign: "center" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 20,
                        fontSize: 13, fontWeight: 600,
                        background: d.employeeCount > 0 ? "var(--surface-2)" : "transparent",
                        color: d.employeeCount > 0 ? "var(--text)" : "var(--text-3)",
                      }}>
                        {d.employeeCount}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                      <Badge color={d.active ? "green" : "gray"} size="sm">
                        {d.active ? "Active" : "Archived"}
                      </Badge>
                    </td>
                    <td style={{ padding: "11px 14px", verticalAlign: "middle", whiteSpace: "nowrap", color: "var(--text-3)", fontSize: 12 }}>
                      {fmtDate(d.createdAt)}
                    </td>
                    <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, whiteSpace: "nowrap" }}>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEdit(d)}
                              style={{ fontSize: 12, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleArchive(d)}
                              style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              {d.active ? "Archive" : "Restore"}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(d)}
                            style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {getErr(d.id) && (
                    <tr>
                      <td colSpan={7} style={{ padding: "6px 14px", background: "var(--red-bg)", color: "var(--red)", fontSize: 12 }}>
                        {getErr(d.id)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .dept-row-hover:hover { background: var(--surface-2); }
      `}</style>
    </div>
  );
}
