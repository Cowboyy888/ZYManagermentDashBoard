import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listPositionsManage } from "@/actions/positions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PositionsClient } from "./PositionsClient";

export default async function PositionsPage() {
  const user = await requireUser();
  const res = await listPositionsManage();

  if (!res.ok) {
    return (
      <div style={{ padding: 24 }}>
        <Alert level="error" title="Failed to load positions" message={"error" in res ? res.error : "Unknown error"} />
      </div>
    );
  }

  const activeCount    = res.data.filter(p => p.active).length;
  const archivedCount  = res.data.filter(p => !p.active).length;
  const totalEmployees = res.data.reduce((s, p) => s + p.employeeCount, 0);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Positions"
        subtitle={`${activeCount} active · ${archivedCount} archived · ${totalEmployees} assigned employees`}
      />
      <PositionsClient
        positions={res.data}
        canEdit={can(user.role, "employee.create")}
        canDelete={can(user.role, "employee.delete")}
      />
    </div>
  );
}
