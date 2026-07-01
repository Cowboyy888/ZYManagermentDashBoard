import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { OvertimeManager } from "./OvertimeManager";

export default async function OvertimePage() {
  const user = await requireUser();

  const [employees, entries] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true },
    }),
    prisma.overtimeEntry.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 200,
      include: { employee: { select: { nameEn: true } } },
    }),
  ]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Overtime</h1>
        <p className="text-sm text-gray-500 mt-0.5">Log and review overtime incidents</p>
      </div>
      <OvertimeManager
        employees={employees}
        initial={entries.map((e) => ({
          id: e.id.toString(),
          employeeId: e.employeeId,
          employeeName: e.employee.nameEn,
          date: e.date.toISOString().slice(0, 10),
          hours: Number(e.hours),
          band: e.band as "NORMAL_1_5" | "NIGHT_2_0" | "HOLIDAY_2_0",
          description: e.description ?? null,
          amountUsd: Number(e.amountUsd),
          status: e.status,
        }))}
        canCreate={can(user.role, "overtime.create")}
      />
    </div>
  );
}
