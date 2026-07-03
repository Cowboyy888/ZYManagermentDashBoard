import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listPositionsManage } from "@/actions/positions";
import { PositionsClient } from "./PositionsClient";

export default async function PositionsPage() {
  const user = await requireUser();

  const res = await listPositionsManage();

  if (!res.ok) {
    return <p style={{ padding: 24, color: "var(--red)" }}>{"error" in res ? res.error : "Failed to load"}</p>;
  }

  const activeCount  = res.data.filter(p => p.active).length;
  const archivedCount = res.data.filter(p => !p.active).length;
  const totalEmployees = res.data.reduce((s, p) => s + p.employeeCount, 0);

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          Positions
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>
          {activeCount} active · {archivedCount} archived · {totalEmployees} assigned employees
        </p>
      </header>
      <PositionsClient
        positions={res.data}
        canEdit={can(user.role, "employee.create")}
        canDelete={can(user.role, "employee.delete")}
      />
    </div>
  );
}
