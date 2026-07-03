import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listPeriodsForManagement } from "@/actions/payroll";
import { PayrollManager } from "./PayrollManager";

export default async function PayrollPage() {
  const user = await requireUser();

  const result = await listPeriodsForManagement();

  const periods = result.ok ? result.data : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Payroll</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Manage pay periods, run payroll, and export payslips
        </p>
      </div>
      <PayrollManager
        periods={periods}
        canRun={can(user.role, "payroll.run")}
        canLock={can(user.role, "payroll.lock")}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
