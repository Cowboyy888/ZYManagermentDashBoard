"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmployeeTable, type EmployeeRow } from "@/components/EmployeeTable";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { deactivateEmployee, getEmployeeForEdit } from "@/actions/employees";

interface Props {
  initial: EmployeeRow[];
  departments: { id: number; name: string }[];
  positions: { id: number; name: string; level: number }[];
  factoryAreas: { id: number; name: string; code: string }[];
  supervisors: { id: number; nameEn: string; nameKh: string }[];
  canEdit: boolean;
}

type StatusFilter = "ACTIVE" | "TERMINATED" | "ALL";

// Full edit data including all fields not available on the list row
type EditingEmployee = {
  id: number;
  nameKh: string; nameZh: string | null; nameEn: string;
  employeeCode: string | null; photoUrl: string | null;
  gender: string | null; birthday: Date | null;
  nationality: string | null; phone: string | null;
  email: string | null; address: string | null;
  emergencyContact: { name?: string; phone?: string; relation?: string } | null;
  positionId: number | null; factoryAreaId: number | null;
  productionLine: string | null; shift: string | null; supervisorId: number | null;
  departmentId: number | null; dailyRateUsd: number;
  hireDate: string; contractExpiry: Date | null; probationEnd: Date | null;
  status: string; note: string | null;
};

export function EmployeeManager({ initial, departments, positions, factoryAreas, supervisors, canEdit }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditingEmployee | null>(null);
  const [adding, setAdding] = useState(false);
  const [fetchingEdit, setFetchingEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [deptFilter, setDeptFilter] = useState<string>("");

  // Client-side filter — no re-fetch needed since all statuses are loaded
  const filteredRows = useMemo(() => {
    return initial
      .filter(e => statusFilter === "ALL" || e.status === statusFilter)
      .filter(e => !deptFilter || String(e.departmentId) === deptFilter);
  }, [initial, statusFilter, deptFilter]);

  async function handleEdit(row: EmployeeRow) {
    setAdding(false);
    setFetchingEdit(true);
    const res = await getEmployeeForEdit(row.id);
    setFetchingEdit(false);
    if (!res.ok) { alert("error" in res ? res.error : "Failed to load employee"); return; }
    const d = res.data;
    setEditing({
      ...d,
      birthday: d.birthday ? new Date(d.birthday) : null,
      contractExpiry: d.contractExpiry ? new Date(d.contractExpiry) : null,
      probationEnd: d.probationEnd ? new Date(d.probationEnd) : null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDeactivate(id: number) {
    if (!confirm("Mark this employee as terminated? Payroll history is preserved.")) return;
    startTransition(async () => {
      const res = await deactivateEmployee(id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function handleDone() {
    setAdding(false);
    setEditing(null);
    router.refresh();
  }

  const statusCounts = useMemo(() => ({
    ACTIVE: initial.filter(e => e.status === "ACTIVE").length,
    TERMINATED: initial.filter(e => e.status === "TERMINATED").length,
    ALL: initial.length,
  }), [initial]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Edit/Create form panel */}
      {(adding || editing) && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {editing ? "Edit Employee" : "New Employee"}
            </h2>
            <button onClick={handleDone}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18 }}>
              ✕
            </button>
          </div>
          <EmployeeForm
            departments={departments}
            positions={positions}
            factoryAreas={factoryAreas}
            supervisors={supervisors}
            editing={editing ?? undefined}
            onDone={handleDone}
          />
        </div>
      )}

      {/* Toolbar: status tabs + dept filter + add button */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Status filter tabs */}
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            {(["ACTIVE", "ALL", "TERMINATED"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "6px 14px", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 500,
                  background: statusFilter === s ? "var(--steel)" : "var(--surface)",
                  color: statusFilter === s ? "#fff" : "var(--text-2)",
                  borderRight: s !== "TERMINATED" ? "1px solid var(--border)" : "none",
                }}
              >
                {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Terminated"}
                <span style={{
                  marginLeft: 6, fontSize: 11,
                  background: statusFilter === s ? "rgba(255,255,255,0.25)" : "var(--surface-2)",
                  borderRadius: 10, padding: "0 5px",
                }}>
                  {statusCounts[s]}
                </span>
              </button>
            ))}
          </div>

          {/* Department filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)",
              fontSize: 12, background: "var(--surface)", color: "var(--text)", cursor: "pointer",
            }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Add button */}
        {!adding && !editing && canEdit && (
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8,
              background: "var(--steel)", color: "#fff",
              border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Employee
          </button>
        )}
      </div>

      {/* Loading overlay while fetching edit data */}
      {fetchingEdit && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "var(--surface-2)", border: "1px solid var(--border)",
          fontSize: 13, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span className="spinner" style={{ width: 14, height: 14 }} /> Loading employee data…
        </div>
      )}

      <EmployeeTable
        data={filteredRows}
        canEdit={canEdit}
        onEdit={handleEdit}
        onDeactivate={onDeactivate}
      />
    </div>
  );
}
