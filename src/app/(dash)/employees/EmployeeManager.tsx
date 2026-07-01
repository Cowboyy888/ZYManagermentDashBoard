"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeTable, type EmployeeRow } from "@/components/EmployeeTable";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { deactivateEmployee } from "@/actions/employees";

interface Props {
  initial: EmployeeRow[];
  departments: { id: number; name: string }[];
  positions: { id: number; name: string; level: number }[];
  factoryAreas: { id: number; name: string; code: string }[];
  supervisors: { id: number; nameEn: string; nameKh: string }[];
  canEdit: boolean;
}

export function EmployeeManager({ initial, departments, positions, factoryAreas, supervisors, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [adding, setAdding] = useState(false);

  async function onDeactivate(id: number) {
    if (!confirm("Mark this employee as terminated? Payroll history is preserved.")) return;
    const res = await deactivateEmployee(id);
    if ('error' in res) alert(res.error);
    else router.refresh();
  }

  function handleEdit(e: EmployeeRow) {
    setAdding(false);
    setEditing(e);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDone() {
    setAdding(false);
    setEditing(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(adding || editing) && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {editing ? "Edit Employee" : "New Employee"}
            </h2>
            <button onClick={handleDone} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18 }}>✕</button>
          </div>
          <EmployeeForm
            departments={departments}
            positions={positions}
            factoryAreas={factoryAreas}
            supervisors={supervisors}
            editing={editing ? {
              id: editing.id,
              nameEn: editing.nameEn, nameKh: editing.nameKh, nameZh: editing.nameZh,
              employeeCode: editing.employeeCode, photoUrl: editing.photoUrl,
              gender: null, birthday: null, nationality: null,
              phone: null, email: null, address: null, emergencyContact: null,
              positionId: null, factoryAreaId: null, productionLine: null,
              shift: editing.shift, supervisorId: null, departmentId: null,
              dailyRateUsd: editing.dailyRateUsd,
              hireDate: new Date().toISOString().slice(0, 10),
              contractExpiry: null, probationEnd: null,
              status: editing.status, note: null,
            } : undefined}
            onDone={handleDone}
          />
        </div>
      )}

      {!adding && !editing && canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setAdding(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: "var(--steel)", color: "#fff",
              border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Employee
          </button>
        </div>
      )}

      <EmployeeTable
        data={initial}
        canEdit={canEdit}
        onEdit={handleEdit}
        onDeactivate={onDeactivate}
      />
    </div>
  );
}
