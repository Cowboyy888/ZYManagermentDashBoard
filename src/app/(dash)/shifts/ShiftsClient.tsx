"use client";
import { useState, useMemo, useTransition } from "react";
import {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getShiftAssignments,
  saveShiftAssignment,
  deleteShiftAssignment,
  bulkAssignShiftToEmployees,
  type ShiftRow,
  type AssignmentRow,
} from "@/actions/shifts";

// ── Types ──────────────────────────────────────────────────────

type EmployeeOption = {
  id: number;
  employeeCode: string | null;
  nameEn: string;
  nameKh: string;
  departmentId: number | null;
  departmentName: string | null;
  positionName: string | null;
};

type Props = {
  initialShifts: ShiftRow[];
  employees:     EmployeeOption[];
  departments:   { id: number; name: string }[];
  canWrite:      boolean;
};

type Tab = "shifts" | "assignments" | "report";

const SHIFT_TYPES = ["DAY", "AFTERNOON", "NIGHT", "ROTATING", "CUSTOM"] as const;

const SHIFT_TYPE_LABEL: Record<string, string> = {
  DAY: "Day", AFTERNOON: "Afternoon", NIGHT: "Night",
  ROTATING: "Rotating", CUSTOM: "Custom",
};

// ── Blank shift form ───────────────────────────────────────────

function blankForm() {
  return {
    code: "", name: "", description: "", shiftType: "DAY" as string,
    startTime: "08:00", endTime: "17:00",
    breakStart: "12:00", breakEnd: "13:00",
    workingHours: 8, otStartsAfter: "17:00",
    gracePeriodMin: 15, color: "#3b82f6", active: true,
  };
}

// ── Styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 34, padding: "0 10px",
  border: "1px solid var(--border)", borderRadius: 6,
  background: "var(--surface)", color: "var(--text)", fontSize: 13,
  width: "100%",
};

const thStyle: React.CSSProperties = {
  padding: "9px 14px", textAlign: "left", fontWeight: 600, fontSize: 11,
  textTransform: "uppercase", letterSpacing: "0.04em",
  color: "var(--text-3)", borderBottom: "1px solid var(--border)",
  background: "var(--surface-2)", whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px", borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

// ── Main component ─────────────────────────────────────────────

export function ShiftsClient({ initialShifts, employees, departments, canWrite }: Props) {
  const [tab, setTab] = useState<Tab>("shifts");
  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm());
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Assignment state
  const [assignShiftId,  setAssignShiftId]  = useState<number | "">("");
  const [assignDeptId,   setAssignDeptId]   = useState<number | "">("");
  const [assignFrom,     setAssignFrom]      = useState(todayStr());
  const [assignTo,       setAssignTo]        = useState("");
  const [assignNotes,    setAssignNotes]     = useState("");
  const [selectedEmps,   setSelectedEmps]    = useState<Set<number>>(new Set());
  const [assigning,      setAssigning]       = useState(false);

  // Assignment filters
  const [filterShiftId,  setFilterShiftId]  = useState<number | "">("");
  const [filterDeptId,   setFilterDeptId]   = useState<number | "">("");
  const [filterActive,   setFilterActive]   = useState(true);

  // ── Helpers ────────────────────────────────────────────────

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function openCreate() {
    setForm(blankForm());
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(s: ShiftRow) {
    setForm({
      code: s.code, name: s.name, description: s.description ?? "",
      shiftType: s.shiftType, startTime: s.startTime, endTime: s.endTime,
      breakStart: s.breakStart ?? "", breakEnd: s.breakEnd ?? "",
      workingHours: s.workingHours,
      otStartsAfter: s.otStartsAfter ?? "",
      gracePeriodMin: s.gracePeriodMin,
      color: s.color, active: s.active,
    });
    setEditingId(s.id);
    setFormError("");
    setShowForm(true);
  }

  // ── Load assignments ────────────────────────────────────────

  function loadAssignments() {
    startTransition(async () => {
      const res = await getShiftAssignments({
        shiftId:      filterShiftId ? Number(filterShiftId) : undefined,
        departmentId: filterDeptId  ? Number(filterDeptId)  : undefined,
        activeOnly:   filterActive,
      });
      if (res.ok) {
        setAssignments(res.data);
        setAssignmentsLoaded(true);
      } else {
        showToast("err", "error" in res ? res.error : "Load failed");
      }
    });
  }

  // ── Save shift ──────────────────────────────────────────────

  function saveForm() {
    setFormError("");
    const payload = {
      ...form,
      description:   form.description   || null,
      breakStart:    form.breakStart    || null,
      breakEnd:      form.breakEnd      || null,
      otStartsAfter: form.otStartsAfter || null,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateShift(editingId, payload)
        : await createShift(payload);

      if (!res.ok) {
        setFormError("error" in res ? res.error : "Save failed");
        return;
      }
      const updated = await getShifts();
      if (updated.ok) setShifts(updated.data);
      setShowForm(false);
      showToast("ok", editingId ? "Shift updated" : "Shift created");
    });
  }

  // ── Delete shift ────────────────────────────────────────────

  function handleDelete(id: number) {
    if (!confirm("Delete this shift?")) return;
    startTransition(async () => {
      const res = await deleteShift(id);
      if (!res.ok) {
        showToast("err", "error" in res ? res.error : "Delete failed");
        return;
      }
      setShifts(prev => prev.filter(s => s.id !== id));
      showToast("ok", "Shift deleted");
    });
  }

  // ── Bulk assign ─────────────────────────────────────────────

  async function handleBulkAssign() {
    if (!assignShiftId || selectedEmps.size === 0) {
      showToast("err", "Select a shift and at least one employee");
      return;
    }
    setAssigning(true);
    try {
      const res = await bulkAssignShiftToEmployees({
        shiftId:      Number(assignShiftId),
        employeeIds:  Array.from(selectedEmps),
        effectiveFrom: new Date(assignFrom + "T00:00:00"),
        effectiveTo:   assignTo ? new Date(assignTo + "T00:00:00") : null,
        notes:         assignNotes || null,
      });
      if (!res.ok) {
        showToast("err", "error" in res ? res.error : "Assign failed");
      } else {
        showToast("ok", `Assigned ${selectedEmps.size} employee(s)`);
        setSelectedEmps(new Set());
        if (assignmentsLoaded) loadAssignments();
      }
    } finally {
      setAssigning(false);
    }
  }

  // ── Remove assignment ───────────────────────────────────────

  async function handleRemoveAssignment(id: number) {
    if (!confirm("Remove this assignment?")) return;
    const res = await deleteShiftAssignment(id);
    if (!res.ok) {
      showToast("err", "error" in res ? res.error : "Remove failed");
      return;
    }
    setAssignments(prev => prev.filter(a => a.id !== id));
    showToast("ok", "Assignment removed");
  }

  // ── Employee filter for bulk assign ────────────────────────

  const filteredEmps = useMemo(() => {
    if (!assignDeptId) return employees;
    return employees.filter(e => e.departmentId === Number(assignDeptId));
  }, [employees, assignDeptId]);

  const allEmpsSelected = filteredEmps.length > 0 && filteredEmps.every(e => selectedEmps.has(e.id));

  function toggleAllEmps() {
    if (allEmpsSelected) {
      setSelectedEmps(new Set());
    } else {
      setSelectedEmps(new Set(filteredEmps.map(e => e.id)));
    }
  }

  // ── Shift report data ────────────────────────────────────────

  const shiftReportData = useMemo(() => {
    return shifts.map(s => ({
      ...s,
      assignments: assignments.filter(a => a.shiftId === s.id),
    }));
  }, [shifts, assignments]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === "ok" ? "var(--green-bg)" : "var(--red-bg)",
          color: toast.type === "ok" ? "var(--green)" : "var(--red)",
          border: `1px solid ${toast.type === "ok" ? "var(--green)" : "var(--red)"}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: "flex", borderRadius: 8, border: "1px solid var(--border)",
        overflow: "hidden", alignSelf: "flex-start",
      }}>
        {([
          { id: "shifts",      label: "Shifts"      },
          { id: "assignments", label: "Assignments"  },
          { id: "report",      label: "Report"       },
        ] as const).map((t, i) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === "assignments" && !assignmentsLoaded) loadAssignments();
            }}
            style={{
              padding: "8px 20px", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              background: tab === t.id ? "var(--steel)" : "var(--surface)",
              color: tab === t.id ? "#fff" : "var(--text-2)",
              borderRight: i < 2 ? "1px solid var(--border)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Shifts Tab ── */}
      {tab === "shifts" && (
        <ShiftsTab
          shifts={shifts}
          canWrite={canWrite}
          isPending={isPending}
          onAdd={openCreate}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* ── Assignments Tab ── */}
      {tab === "assignments" && (
        <AssignmentsTab
          shifts={shifts}
          employees={employees}
          departments={departments}
          filteredEmps={filteredEmps}
          assignments={assignments}
          assignmentsLoaded={assignmentsLoaded}
          canWrite={canWrite}
          isPending={isPending}
          assigning={assigning}
          assignShiftId={assignShiftId}
          assignDeptId={assignDeptId}
          assignFrom={assignFrom}
          assignTo={assignTo}
          assignNotes={assignNotes}
          selectedEmps={selectedEmps}
          allEmpsSelected={allEmpsSelected}
          filterShiftId={filterShiftId}
          filterDeptId={filterDeptId}
          filterActive={filterActive}
          onSetAssignShiftId={setAssignShiftId}
          onSetAssignDeptId={v => { setAssignDeptId(v); setSelectedEmps(new Set()); }}
          onSetAssignFrom={setAssignFrom}
          onSetAssignTo={setAssignTo}
          onSetAssignNotes={setAssignNotes}
          onToggleEmp={id => setSelectedEmps(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
          })}
          onToggleAllEmps={toggleAllEmps}
          onBulkAssign={handleBulkAssign}
          onSetFilterShiftId={setFilterShiftId}
          onSetFilterDeptId={setFilterDeptId}
          onSetFilterActive={setFilterActive}
          onLoadAssignments={loadAssignments}
          onRemoveAssignment={handleRemoveAssignment}
        />
      )}

      {/* ── Report Tab ── */}
      {tab === "report" && (
        <ReportTab shifts={shifts} assignments={assignments} assignmentsLoaded={assignmentsLoaded} onLoad={loadAssignments} />
      )}

      {/* ── Shift Form Modal ── */}
      {showForm && (
        <ShiftFormModal
          form={form}
          editingId={editingId}
          error={formError}
          isPending={isPending}
          onClose={() => setShowForm(false)}
          onChange={patch => setForm(f => ({ ...f, ...patch }))}
          onSave={saveForm}
        />
      )}
    </div>
  );
}

// ── Shifts Tab ────────────────────────────────────────────────

function ShiftsTab({
  shifts, canWrite, isPending, onAdd, onEdit, onDelete,
}: {
  shifts: ShiftRow[];
  canWrite: boolean;
  isPending: boolean;
  onAdd: () => void;
  onEdit: (s: ShiftRow) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {canWrite && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onAdd} disabled={isPending} className="btn btn-primary">
            + New Shift
          </button>
        </div>
      )}

      {shifts.length === 0 ? (
        <div style={{
          borderRadius: 10, border: "1.5px dashed var(--border)",
          padding: "40px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
        }}>
          No shifts defined yet. {canWrite && "Click \"+ New Shift\" to create one."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Hours</th>
                <th style={thStyle}>Start</th>
                <th style={thStyle}>End</th>
                <th style={thStyle}>Break</th>
                <th style={thStyle}>OT Starts</th>
                <th style={thStyle}>Grace</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Assigned</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                {canWrite && <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: s.color, flexShrink: 0,
                      }} />
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{s.code}</span>
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.description}</div>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: "var(--surface-2)", color: "var(--text-2)",
                    }}>
                      {SHIFT_TYPE_LABEL[s.shiftType] ?? s.shiftType}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.workingHours}h</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{s.startTime}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{s.endTime}</td>
                  <td style={{ ...tdStyle, color: "var(--text-3)", fontSize: 12 }}>
                    {s.breakStart && s.breakEnd ? `${s.breakStart}–${s.breakEnd}` : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", color: "var(--text-2)" }}>
                    {s.otStartsAfter ?? "—"}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-2)" }}>
                    {s.gracePeriodMin}m
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{
                      padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: s.assignmentCount > 0 ? "var(--green-bg)" : "var(--surface-2)",
                      color: s.assignmentCount > 0 ? "var(--green)" : "var(--text-3)",
                    }}>
                      {s.assignmentCount}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{
                      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: s.active ? "var(--green-bg)" : "var(--red-bg)",
                      color: s.active ? "var(--green)" : "var(--red)",
                    }}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canWrite && (
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => onEdit(s)}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                            border: "1px solid var(--border)", background: "var(--surface)",
                            color: "var(--text-2)",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(s.id)}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                            border: "1px solid var(--red)", background: "var(--red-bg)",
                            color: "var(--red)",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Assignments Tab ───────────────────────────────────────────

type AssignTabProps = {
  shifts: ShiftRow[];
  employees: EmployeeOption[];
  departments: { id: number; name: string }[];
  filteredEmps: EmployeeOption[];
  assignments: AssignmentRow[];
  assignmentsLoaded: boolean;
  canWrite: boolean;
  isPending: boolean;
  assigning: boolean;
  assignShiftId: number | "";
  assignDeptId: number | "";
  assignFrom: string;
  assignTo: string;
  assignNotes: string;
  selectedEmps: Set<number>;
  allEmpsSelected: boolean;
  filterShiftId: number | "";
  filterDeptId: number | "";
  filterActive: boolean;
  onSetAssignShiftId: (v: number | "") => void;
  onSetAssignDeptId: (v: number | "") => void;
  onSetAssignFrom: (v: string) => void;
  onSetAssignTo: (v: string) => void;
  onSetAssignNotes: (v: string) => void;
  onToggleEmp: (id: number) => void;
  onToggleAllEmps: () => void;
  onBulkAssign: () => void;
  onSetFilterShiftId: (v: number | "") => void;
  onSetFilterDeptId: (v: number | "") => void;
  onSetFilterActive: (v: boolean) => void;
  onLoadAssignments: () => void;
  onRemoveAssignment: (id: number) => void;
};

function AssignmentsTab(p: AssignTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Bulk assign panel ── */}
      {p.canWrite && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Assign Shift to Employees</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <Field label="Shift">
              <select
                value={p.assignShiftId}
                onChange={e => p.onSetAssignShiftId(e.target.value ? Number(e.target.value) : "")}
                style={{ ...inputStyle, width: 180 }}
              >
                <option value="">Select shift…</option>
                {p.shifts.filter(s => s.active).map(s => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Department filter">
              <select
                value={p.assignDeptId}
                onChange={e => p.onSetAssignDeptId(e.target.value ? Number(e.target.value) : "")}
                style={{ ...inputStyle, width: 160 }}
              >
                <option value="">All departments</option>
                {p.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Effective from">
              <input type="date" value={p.assignFrom} onChange={e => p.onSetAssignFrom(e.target.value)}
                style={{ ...inputStyle, width: 140 }} />
            </Field>
            <Field label="Effective to (optional)">
              <input type="date" value={p.assignTo} onChange={e => p.onSetAssignTo(e.target.value)}
                style={{ ...inputStyle, width: 140 }} />
            </Field>
            <Field label="Notes">
              <input value={p.assignNotes} onChange={e => p.onSetAssignNotes(e.target.value)}
                placeholder="Optional notes…"
                style={{ ...inputStyle, width: 200 }} />
            </Field>
          </div>

          {/* Employee list */}
          <div style={{
            border: "1px solid var(--border)", borderRadius: 8, maxHeight: 280, overflowY: "auto",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--surface-2)", zIndex: 1 }}>
                <tr>
                  <th style={{ ...thStyle, width: 40 }}>
                    <input type="checkbox" checked={p.allEmpsSelected} onChange={p.onToggleAllEmps} />
                  </th>
                  <th style={thStyle}>Employee</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Position</th>
                </tr>
              </thead>
              <tbody>
                {p.filteredEmps.map(e => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...tdStyle, textAlign: "center", padding: "6px 10px" }}>
                      <input
                        type="checkbox"
                        checked={p.selectedEmps.has(e.id)}
                        onChange={() => p.onToggleEmp(e.id)}
                      />
                    </td>
                    <td style={{ ...tdStyle, padding: "6px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{e.nameEn}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>{e.nameKh}</div>
                    </td>
                    <td style={{ ...tdStyle, padding: "6px 12px", color: "var(--text-2)" }}>
                      {e.departmentName ?? "—"}
                    </td>
                    <td style={{ ...tdStyle, padding: "6px 12px", color: "var(--text-2)" }}>
                      {e.positionName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {p.selectedEmps.size} employee(s) selected
            </span>
            <button
              onClick={p.onBulkAssign}
              disabled={p.assigning || p.selectedEmps.size === 0 || !p.assignShiftId}
              className="btn btn-primary"
            >
              {p.assigning ? "Assigning…" : "Assign Shift"}
            </button>
          </div>
        </div>
      )}

      {/* ── Existing assignments ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <Field label="Filter by shift">
          <select value={p.filterShiftId} onChange={e => p.onSetFilterShiftId(e.target.value ? Number(e.target.value) : "")}
            style={{ ...inputStyle, width: 160 }}>
            <option value="">All shifts</option>
            {p.shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Filter by dept">
          <select value={p.filterDeptId} onChange={e => p.onSetFilterDeptId(e.target.value ? Number(e.target.value) : "")}
            style={{ ...inputStyle, width: 150 }}>
            <option value="">All</option>
            {p.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Active only">
          <select value={String(p.filterActive)} onChange={e => p.onSetFilterActive(e.target.value === "true")}
            style={{ ...inputStyle, width: 110 }}>
            <option value="true">Active</option>
            <option value="false">All</option>
          </select>
        </Field>
        <button onClick={p.onLoadAssignments} disabled={p.isPending} className="btn btn-primary"
          style={{ alignSelf: "flex-end" }}>
          {p.isPending ? "Loading…" : "Refresh"}
        </button>
      </div>

      {p.assignmentsLoaded && (
        p.assignments.length === 0 ? (
          <div style={{
            borderRadius: 10, border: "1.5px dashed var(--border)",
            padding: "32px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
          }}>
            No assignments found.
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Shift</th>
                  <th style={thStyle}>Employee</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Effective From</th>
                  <th style={thStyle}>Effective To</th>
                  <th style={thStyle}>Notes</th>
                  {p.canWrite && <th style={{ ...thStyle, textAlign: "center" }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {p.assignments.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.shiftColor }} />
                        <span style={{ fontWeight: 600 }}>{a.shiftCode}</span>
                        <span style={{ color: "var(--text-2)" }}>{a.shiftName}</span>
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{a.nameEn}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{a.nameKh}</div>
                    </td>
                    <td style={{ ...tdStyle, color: "var(--text-2)" }}>{a.departmentName ?? "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{a.effectiveFrom}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", color: "var(--text-3)" }}>
                      {a.effectiveTo ?? "—"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--text-2)" }}>{a.notes ?? "—"}</td>
                    {p.canWrite && (
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button
                          onClick={() => p.onRemoveAssignment(a.id)}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                            border: "1px solid var(--red)", background: "var(--red-bg)",
                            color: "var(--red)",
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ── Report Tab ────────────────────────────────────────────────

function ReportTab({
  shifts, assignments, assignmentsLoaded, onLoad,
}: {
  shifts: ShiftRow[];
  assignments: AssignmentRow[];
  assignmentsLoaded: boolean;
  onLoad: () => void;
}) {
  async function handleExport(fmt: "excel" | "pdf") {
    const { exportToExcel, exportToPDF } = await import("@/lib/export");
    const data = assignments.map(a => ({
      shift:     a.shiftName,
      code:      a.shiftCode,
      employee:  a.nameEn,
      dept:      a.departmentName ?? "—",
      from:      a.effectiveFrom,
      to:        a.effectiveTo ?? "—",
    }));
    const cols = [
      { header: "Shift",        key: "shift",    width: 18 },
      { header: "Code",         key: "code",     width: 10 },
      { header: "Employee",     key: "employee", width: 24 },
      { header: "Department",   key: "dept",     width: 20 },
      { header: "From",         key: "from",     width: 14 },
      { header: "To",           key: "to",       width: 14 },
    ];
    if (fmt === "excel") await exportToExcel(data, cols, "shift-assignments");
    else await exportToPDF("ZY Steel — Shift Assignments", "", data, cols, "shift-assignments");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {!assignmentsLoaded && (
          <button onClick={onLoad} className="btn btn-primary">Load Report Data</button>
        )}
        {assignmentsLoaded && (
          <>
            <button onClick={() => handleExport("excel")} style={{
              padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text-2)", fontSize: 13, cursor: "pointer",
            }}>
              Export Excel
            </button>
            <button onClick={() => handleExport("pdf")} style={{
              padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text-2)", fontSize: 13, cursor: "pointer",
            }}>
              Export PDF
            </button>
          </>
        )}
      </div>

      {/* Summary cards per shift */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {shifts.map(s => {
          const count = assignments.filter(a => a.shiftId === s.id).length;
          return (
            <div key={s.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "14px 16px",
              borderLeft: `4px solid ${s.color}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                <span style={{
                  padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                  background: s.active ? "var(--green-bg)" : "var(--red-bg)",
                  color: s.active ? "var(--green)" : "var(--red)",
                }}>
                  {s.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{s.startTime} – {s.endTime} · {s.workingHours}h</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginTop: 8 }}>
                {assignmentsLoaded ? count : "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>employees assigned</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shift Form Modal ──────────────────────────────────────────

type FormData = ReturnType<typeof blankForm>;

function ShiftFormModal({
  form, editingId, error, isPending, onClose, onChange, onSave,
}: {
  form: ReturnType<typeof blankForm>;
  editingId: number | null;
  error: string;
  isPending: boolean;
  onClose: () => void;
  onChange: (patch: Partial<typeof form>) => void;
  onSave: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--surface)", borderRadius: 14, padding: 24,
        width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", marginBottom: 20 }}>
          {editingId ? "Edit Shift" : "New Shift"}
        </div>

        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Shift Code *">
            <input value={form.code} onChange={e => onChange({ code: e.target.value.toUpperCase() })}
              placeholder="e.g. DAY1" style={inputStyle} />
          </FormField>
          <FormField label="Shift Name *">
            <input value={form.name} onChange={e => onChange({ name: e.target.value })}
              placeholder="e.g. Day Shift" style={inputStyle} />
          </FormField>
          <FormField label="Shift Type">
            <select value={form.shiftType} onChange={e => onChange({ shiftType: e.target.value })}
              style={inputStyle}>
              {SHIFT_TYPES.map(t => <option key={t} value={t}>{SHIFT_TYPE_LABEL[t]}</option>)}
            </select>
          </FormField>
          <FormField label="Working Hours *">
            <input type="number" min="1" max="24" step="0.5"
              value={form.workingHours}
              onChange={e => onChange({ workingHours: Number(e.target.value) })}
              style={inputStyle} />
          </FormField>
          <FormField label="Start Time *">
            <input type="time" value={form.startTime} onChange={e => onChange({ startTime: e.target.value })}
              style={inputStyle} />
          </FormField>
          <FormField label="End Time *">
            <input type="time" value={form.endTime} onChange={e => onChange({ endTime: e.target.value })}
              style={inputStyle} />
          </FormField>
          <FormField label="Break Start">
            <input type="time" value={form.breakStart} onChange={e => onChange({ breakStart: e.target.value })}
              style={inputStyle} />
          </FormField>
          <FormField label="Break End">
            <input type="time" value={form.breakEnd} onChange={e => onChange({ breakEnd: e.target.value })}
              style={inputStyle} />
          </FormField>
          <FormField label="Overtime Starts After">
            <input type="time" value={form.otStartsAfter} onChange={e => onChange({ otStartsAfter: e.target.value })}
              style={inputStyle} />
          </FormField>
          <FormField label="Grace Period (minutes)">
            <input type="number" min="0" max="120"
              value={form.gracePeriodMin}
              onChange={e => onChange({ gracePeriodMin: Number(e.target.value) })}
              style={inputStyle} />
          </FormField>
          <FormField label="Color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="color" value={form.color}
                onChange={e => onChange({ color: e.target.value })}
                style={{ width: 40, height: 34, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }} />
              <input value={form.color} onChange={e => onChange({ color: e.target.value })}
                style={{ ...inputStyle, flex: 1 }} />
            </div>
          </FormField>
          <FormField label="Status">
            <select value={String(form.active)} onChange={e => onChange({ active: e.target.value === "true" })}
              style={inputStyle}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
        </div>

        <div style={{ gridColumn: "1/-1", marginTop: 8 }}>
          <FormField label="Description">
            <textarea value={form.description} onChange={e => onChange({ description: e.target.value })}
              rows={2} placeholder="Optional description…"
              style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }} />
          </FormField>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-2)", fontSize: 13, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={isPending} className="btn btn-primary">
            {isPending ? "Saving…" : editingId ? "Update Shift" : "Create Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>{label}</label>
      {children}
    </div>
  );
}
