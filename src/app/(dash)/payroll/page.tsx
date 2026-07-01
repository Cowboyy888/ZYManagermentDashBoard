import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PayrollManager } from "./PayrollManager";

export default async function PayrollPage() {
  const user = await requireUser();

  const periods = await prisma.payPeriod.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
        <p className="text-sm text-gray-500 mt-0.5">Run, review, lock and export payroll by period</p>
      </div>
      <PayrollManager
        periods={periods.map((p) => ({
          id: p.id,
          year: p.year,
          month: p.month,
          half: p.half,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
          workingDays: p.workingDays,
          locked: p.locked,
        }))}
        canRun={can(user.role, "payroll.run")}
        canLock={can(user.role, "payroll.lock")}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
