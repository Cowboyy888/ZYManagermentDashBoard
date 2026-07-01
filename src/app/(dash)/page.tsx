import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  await requireUser();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const in7  = new Date(today); in7.setDate(today.getDate() + 7);

  // Current month attendance summary
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    headcount,
    departments,
    latestPeriod,
    recentOt,
    contractExpiring30,
    contractExpiring7,
    todayBirthdays,
    attendanceSummary,
    hiringByMonth,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),

    prisma.department.findMany({
      include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
      orderBy: { name: "asc" },
    }),

    prisma.payPeriod.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }] }),

    prisma.overtimeEntry.findMany({
      take: 8,
      orderBy: { date: "desc" },
      include: { employee: { select: { nameEn: true, nameKh: true } } },
    }),

    // Contracts expiring in 30 days
    prisma.employee.count({
      where: { status: "ACTIVE", contractExpiry: { not: null, lte: in30, gte: today } },
    }),

    // Contracts expiring in 7 days (urgent)
    prisma.employee.count({
      where: { status: "ACTIVE", contractExpiry: { not: null, lte: in7, gte: today } },
    }),

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
    })),

    // Attendance summary for today
    prisma.attendanceDay.groupBy({
      by: ["am"],
      where: { date: { equals: new Date(todayIso) } },
      _count: { am: true },
    }).catch(() => []),

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
    }),
  ]);

  const periodPayslips = latestPeriod
    ? await prisma.payslip.aggregate({
        where: { periodId: latestPeriod.id },
        _sum: { grossUsd: true, netUsd: true },
        _count: true,
      })
    : null;

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
        latestPeriod={latestPeriod ? {
          label: `${latestPeriod.year}-${String(latestPeriod.month).padStart(2, "0")} H${latestPeriod.half}`,
          locked: latestPeriod.locked,
          grossUsd: periodPayslips?._sum?.grossUsd ? Number(periodPayslips._sum.grossUsd) : null,
          count: periodPayslips?._count ?? 0,
        } : null}
      />
    </div>
  );
}
