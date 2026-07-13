import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const user = await requireUser();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const in7  = new Date(today); in7.setDate(today.getDate() + 7);

  // Current month attendance summary
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const canReadProduction = can(user.role, "production.read");
  const canReadInventory  = can(user.role, "inventory.read");

  const [
    headcount,
    departments,
    latestPeriod,
    recentOt,
    contractExpiring30,
    contractExpiring7,
    todayBirthdays,
    attendanceSummary,
    monthlyAttendanceRate,
    pendingLeaveCount,
    onLeaveTodayCount,
    hiringByMonth,
    activeProductionOrders,
    machineStatusCounts,
    lowStockCount,
    criticalAlarmCount,
    wireRemainingKg,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }).catch(() => 0),

    prisma.department.findMany({
      include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
      orderBy: { name: "asc" },
    }).catch(() => []),

    prisma.payPeriod.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
      select: { id: true, year: true, month: true, half: true, locked: true, name: true, payrollDate: true, endDate: true },
    }).catch(() => null),

    prisma.overtimeEntry.findMany({
      take: 8,
      orderBy: { date: "desc" },
      include: { employee: { select: { nameEn: true, nameKh: true } } },
    }).catch(() => []),

    // Contracts expiring in 30 days
    prisma.employee.count({
      where: { status: "ACTIVE", contractExpiry: { not: null, lte: in30, gte: today } },
    }).catch(() => 0),

    // Contracts expiring in 7 days (urgent)
    prisma.employee.count({
      where: { status: "ACTIVE", contractExpiry: { not: null, lte: in7, gte: today } },
    }).catch(() => 0),

    // Today's birthdays (same month + day)
    prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        birthday: { not: null },
      },
      select: { id: true, nameEn: true, nameKh: true, birthday: true },
    }).then(emps => emps.filter(e => {
      if (!e.birthday) return false;
      const b = new Date(e.birthday);
      return b.getMonth() === today.getMonth() && b.getDate() === today.getDate();
    })).catch(() => []),

    // Attendance summary for today
    prisma.attendanceDay.groupBy({
      by: ["am"],
      where: { date: { equals: new Date(todayIso) } },
      _count: { am: true },
    }).catch(() => []),

    // Monthly attendance rate (present half-slots / total half-slots)
    prisma.attendanceDay.findMany({
      where: { date: { gte: thisMonthStart } },
      select: { am: true, pm: true },
    }).then(days => {
      let present = 0, total = 0;
      for (const d of days) {
        total += 2;
        if (d.am === "PRESENT") present++;
        if (d.pm === "PRESENT") present++;
      }
      return total > 0 ? Math.round((present / total) * 100) : null;
    }).catch(() => null),

    // Pending leave approvals
    prisma.leaveRequest.count({ where: { status: "PENDING" } }).catch(() => 0),

    // Employees on approved leave today
    prisma.leaveRequest.count({
      where: {
        status: "APPROVED",
        startDate: { lte: new Date(todayIso) },
        endDate:   { gte: new Date(todayIso) },
      },
    }).catch(() => 0),

    // Hiring trends — last 6 months
    prisma.employee.findMany({
      where: {
        hireDate: { gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) },
      },
      select: { hireDate: true },
    }).then(emps => {
      const counts: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        counts[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
      }
      emps.forEach(e => {
        const k = `${e.hireDate.getFullYear()}-${String(e.hireDate.getMonth() + 1).padStart(2, "0")}`;
        if (k in counts) counts[k]++;
      });
      return Object.entries(counts).map(([month, count]) => ({ month, count }));
    }).catch(() => [] as { month: string; count: number }[]),

    canReadProduction
      ? prisma.productionOrder.count({ where: { status: "IN_PROGRESS" } }).catch(() => null)
      : Promise.resolve(null),

    canReadProduction
      ? prisma.machine.groupBy({ by: ["status"], _count: { status: true } }).catch(() => null)
      : Promise.resolve(null),

    canReadInventory
      ? prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count FROM "InventoryItem" WHERE "currentStock" < "minStock"
        `.then(rows => Number(rows[0]?.count ?? 0)).catch(() => null)
      : Promise.resolve(null),

    canReadProduction
      ? prisma.factoryAlarm.count({ where: { status: "ACTIVE", severity: "CRITICAL" } }).catch(() => null)
      : Promise.resolve(null),

    canReadInventory
      ? prisma.wireInventory.aggregate({ _sum: { remainingKg: true } })
          .then(r => r._sum.remainingKg ? Number(r._sum.remainingKg) : 0)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // Resolve machine status into named counts
  const machineOnline = machineStatusCounts?.find(r => r.status === "OPERATIONAL")?._count?.status ?? 0;
  const machineOffline = machineStatusCounts
    ? (machineStatusCounts.find(r => r.status === "OFFLINE")?._count?.status ?? 0)
    : 0;
  const machineMaintenance = machineStatusCounts
    ? (machineStatusCounts.find(r => r.status === "UNDER_MAINTENANCE")?._count?.status ?? 0)
    : 0;
  const machineTotal = machineOnline + machineOffline + machineMaintenance;

  const [periodPayslips, periodFinalized] = latestPeriod
    ? await Promise.all([
        prisma.payslip.aggregate({
          where: { periodId: latestPeriod.id },
          _sum: { grossUsd: true, netUsd: true },
          _count: true,
        }).catch(() => null),
        prisma.payslip.count({ where: { periodId: latestPeriod.id, finalized: true } }).catch(() => 0),
      ])
    : [null, 0];

  // Flatten attendance summary
  const presentToday = attendanceSummary.find(r => r.am === "PRESENT")?._count?.am ?? 0;
  const leaveToday   = attendanceSummary.find(r => r.am === "LEAVE")?._count?.am ?? 0;
  const absentToday  = attendanceSummary.find(r => r.am === "ABSENT")?._count?.am ?? 0;

  return (
    <div style={{ padding: 24 }}>
      <DashboardClient
        headcount={headcount}
        presentToday={presentToday}
        leaveToday={leaveToday}
        absentToday={absentToday}
        contractExpiring30={contractExpiring30}
        contractExpiring7={contractExpiring7}
        todayBirthdays={todayBirthdays.map(e => ({
          id: e.id, nameEn: e.nameEn, nameKh: e.nameKh,
        }))}
        departments={departments.map(d => ({
          id: d.id, name: d.name, count: d._count.employees,
        }))}
        recentOt={recentOt.map(o => ({
          id: Number(o.id),
          date: o.date.toISOString(),
          hours: Number(o.hours),
          band: o.band,
          amountUsd: Number(o.amountUsd),
          description: o.description,
          employee: { nameEn: o.employee.nameEn, nameKh: o.employee.nameKh },
        }))}
        hiringByMonth={hiringByMonth}
        monthlyAttendanceRate={monthlyAttendanceRate}
        pendingLeaveCount={pendingLeaveCount}
        onLeaveTodayCount={onLeaveTodayCount}
        latestPeriod={latestPeriod ? {
          label: latestPeriod.name ?? `${latestPeriod.year}-${String(latestPeriod.month).padStart(2, "0")} ${latestPeriod.half === 1 ? "1st Half" : "2nd Half"}`,
          locked: latestPeriod.locked,
          grossUsd: periodPayslips?._sum?.grossUsd ? Number(periodPayslips._sum.grossUsd) : null,
          count: periodPayslips?._count ?? 0,
          finalizedCount: periodFinalized,
          payrollDate: latestPeriod.payrollDate ? latestPeriod.payrollDate.toISOString() : null,
          periodEndDate: latestPeriod.endDate.toISOString(),
        } : null}
        opsKpis={canReadProduction || canReadInventory ? {
          activeProductionOrders: activeProductionOrders ?? null,
          machineOnline,
          machineOffline,
          machineMaintenance,
          machineTotal,
          lowStockCount: lowStockCount ?? null,
          criticalAlarmCount: criticalAlarmCount ?? null,
          wireRemainingKg: wireRemainingKg ?? null,
          canProduction: canReadProduction,
          canInventory: canReadInventory,
        } : null}
      />
    </div>
  );
}
