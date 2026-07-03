"use client";
import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PosRow } from "@/actions/positions";
import {
  createPosition, updatePosition, deletePosition, archivePosition,
} from "@/actions/positions";

interface Props {
  positions: PosRow[];
  canEdit:   boolean;
  canDelete: boolean;
}

type StatusTab = "active" | "archived" | "all";

const LEVEL_META: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: "Worker",      bg: "var(--surface-2)",  color: "var(--text-3)" },
  2: { label: "Team Leader", bg: "var(--blue-bg)",    color: "var(--blue)"   },
  3: { label: "Manager",     bg: "var(--purple-bg)",  color: "var(--purple)" },
  4: { label: "Director",    bg: "var(--steel-light)", color: "var(--steel)"  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Inline form ─────────────────────────────────────────────────────────────

function PosForm({
  editing, onDone,
}: { editing?: PosRow; onDone: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [err,    setErr]    = useState("");
  const [saving, setSaving] = useState(false);

  const [name,  setName]  = useState(editing?.name        ?? "");
  const [code,  setCode]  = useState(editing?.code        ?? "");
  const [level, setLevel] = useState(String(editing?.level ?? 1));
  const [desc,  setDesc]  = useState(editing?.description ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    const payload = {
      name,
      code:        code  || null,
      level:       Number(level),
      description: desc  || null,
    };
    const res = editing
      ? await updatePosition(editing.id, payload)
      : await createPosition(payload);
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
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "var(--text-2)",
    marginBottom: 4, display: "block",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px", gap: 12 }}>
        <div>
          <label style={labelStyle}>Position Name <span style={{ color: "var(--red)" }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="e.g. Wire Operator" />
        </div>
        <div>
          <label style={labelStyle}>Code</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={inputStyle} placeholder="WO" maxLength={20} />
        </div>
        <div>
          <label style={labelStyle}>Salary Grade / Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} style={inputStyle}>
            <option value="1">1 — Worker</option>
            <option value="2">2 — Team Leader</option>
            <option value="3">3 — Manager</option>
            <option value="4">4 — Director</option>
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
        <button
          type="submit" disabled={saving}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: "var(--steel)", color: "#fff",
            fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : editing ? "Save Changes" : "Create Position"}
        </button>
        <button
          type="button" onClick={onDone}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text-2)", fontSize: 13, cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main client ──────────────────────────────────────────────────────────────

export function PositionsClient({ positions, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [statusTab,    setStatusTab]    = useState<StatusTab>("active");
  const [search,       setSearch]       = useState("");
  const [sortBy,       setSortBy]       = useState<"name" | "level" | "count">("level");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("asc");
  const [showForm,     setShowForm]     = useState(false);
  const [editingPos,   setEditingPos]   = useState<PosRow | null>(null);
  const [rowErrors,    setRowErrors]    = useState<Record<number, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return positions
      .filter(p =>
        statusTab === "all"    ? true :
        statusTab === "active" ? p.active :
                                 !p.active
      )
      .filter(p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase() ?? "").includes(q) ||
        (LEVEL_META[p.level]?.label ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name")  cmp = a.name.localeCompare(b.name);
        if (sortBy === "level") cmp = a.level - b.level || a.name.localeCompare(b.name);
        if (sortBy === "count") cmp = b.employeeCount - a.employeeCount;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [positions, statusTab, search, sortBy, sortDir]);

  const counts = useMemo(() => ({
    active:   positions.filter(p => p.active).length,
    archived: positions.filter(p => !p.active).length,
    all:      positions.length,
  }), [positions]);

  // Level counts for KPI bar
  const levelCounts = useMemo(() =>
    [1, 2, 3, 4].map(l => ({
      ...LEVEL_META[l],
      count: positions.filter(p => p.level === l && p.active).length,
    })), [positions]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }
  function sortIndicator(col: typeof sortBy) {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function setRowErr(id: number, msg: string) {
    setRowErrors(prev => ({ ...prev, [id]: msg }));
  }

  async function handleArchive(pos: PosRow) {
    setRowErr(pos.id, "");
    const res = await archivePosition(pos.id, !pos.active);
    if (!res.ok) { setRowErr(pos.id, "error" in res ? res.error : "Failed"); return; }
    startTransition(() => router.refresh());
  }

  async function handleDelete(pos: PosRow) {
    if (!confirm(`Delete "${pos.name}"? This cannot be undone.`)) return;
    setRowErr(pos.id, "");
    const res = await deletePosition(pos.id);
    if (!res.ok) { setRowErr(pos.id, "error" in res ? res.error : "Failed"); return; }
    startTransition(() => router.refresh());
  }

  function openCreate() { setEditingPos(null); setShowForm(true); }
  function openEdit(p: PosRow) { setEditingPos(p); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditingPos(null); }

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
  const thStyle = (col: typeof sortBy | null): React.CSSProperties => ({
    padding: "9px 14px", textAlign: "left",
    fontWeight: 600, fontSize: 11, textTransform: "uppercase",
    letterSpacing: "0.04em", color: "var(--text-3)",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    cursor: col ? "pointer" : "default", userSelect: "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Level KPI bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {levelCounts.map(l => (
          <div key={l.label} style={{
            flex: "1 1 120px", padding: "12px 16px", borderRadius: 10,
            border: "1px solid var(--border)", background: "var(--surface)",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: l.color, background: l.bg, borderRadius: 20, padding: "1px 8px", display: "inline-block", width: "fit-content" }}>
              {l.label}
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{l.count}</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>active positions</span>
          </div>
        ))}
      </div>

      {/* Inline form panel */}
      {showForm && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {editingPos ? "Edit Position" : "New Position"}
            </h2>
            <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18 }}>✕</button>
          </div>
          <PosForm editing={editingPos ?? undefined} onDone={closeForm} />
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
            placeholder="Search name, code, grade…"
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
              fontSize: 13, background: "var(--surface)", color: "var(--text)", width: 220,
            }}
          />
        </div>
        {canEdit && !showForm && (
          <button
            onClick={openCreate}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8,
              background: "var(--steel)", color: "#fff",
              border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Position
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          borderRadius: 10, border: "1.5px dashed var(--border)",
          padding: "48px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
        }}>
          {search ? "No positions match your search." : "No positions yet."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th onClick={() => toggleSort("name")} style={thStyle("name")}>
                  Name / Code{sortIndicator("name")}
                </th>
                <th onClick={() => toggleSort("level")} style={thStyle("level")}>
                  Salary Grade{sortIndicator("level")}
                </th>
                <th style={thStyle(null)}>Description</th>
                <th onClick={() => toggleSort("count")} style={{ ...thStyle("count"), textAlign: "center" }}>
                  Employees{sortIndicator("count")}
                </th>
                <th style={thStyle(null)}>Status</th>
                <th style={thStyle(null)}>Created</th>
                <th style={thStyle(null)}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const meta = LEVEL_META[p.level] ?? LEVEL_META[1];
                return (
                  <React.Fragment key={p.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)" }} className="pos-row-hover">
                      <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</div>
                        {p.code && (
                          <span style={{
                            display: "inline-block", marginTop: 3, padding: "0 6px",
                            borderRadius: 4, background: "var(--blue-bg)", color: "var(--blue)",
                            fontWeight: 700, fontSize: 11,
                          }}>{p.code}</span>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 20,
                          fontSize: 12, fontWeight: 600,
                          background: meta.bg, color: meta.color,
                        }}>
                          {p.level} — {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", verticalAlign: "middle", maxWidth: 260 }}>
                        <span style={{ color: "var(--text-2)", fontSize: 12 }}>{p.description || "—"}</span>
                      </td>
                      <td style={{ padding: "11px 14px", verticalAlign: "middle", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 20,
                          fontSize: 13, fontWeight: 600,
                          background: p.employeeCount > 0 ? "var(--surface-2)" : "transparent",
                          color: p.employeeCount > 0 ? "var(--text)" : "var(--text-3)",
                        }}>
                          {p.employeeCount}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 20,
                          fontSize: 11, fontWeight: 600,
                          background: p.active ? "var(--green-bg)" : "var(--border)",
                          color: p.active ? "var(--green)" : "var(--text-3)",
                        }}>
                          {p.active ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", verticalAlign: "middle", whiteSpace: "nowrap", color: "var(--text-3)", fontSize: 12 }}>
                        {fmtDate(p.createdAt)}
                      </td>
                      <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, whiteSpace: "nowrap" }}>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => openEdit(p)}
                                style={{ fontSize: 12, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleArchive(p)}
                                style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                {p.active ? "Archive" : "Restore"}
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(p)}
                              style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {rowErrors[p.id] && (
                      <tr>
                        <td colSpan={7} style={{ padding: "6px 14px", background: "var(--red-bg)", color: "var(--red)", fontSize: 12 }}>
                          {rowErrors[p.id]}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .pos-row-hover:hover { background: var(--surface-2); }
      `}</style>
    </div>
  );
}
