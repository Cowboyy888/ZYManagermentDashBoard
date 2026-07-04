import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getInventoryExecutiveSummary } from "@/actions/inventory";
import { getPurchasingExecutiveSummary } from "@/actions/purchasing";
import { getSalesExecutiveSummary } from "@/actions/sales";
import { getQualityExecutiveSummary } from "@/actions/quality";
import { getMaintenanceExecutiveSummary } from "@/actions/maintenance";
import { getFinanceExecutiveSummary } from "@/actions/finance";
import { ExecutiveDashboard } from "./ExecutiveDashboard";

function plabel(p: { name?: string | null; year: number; month: number; half: number }) {
  if (p.name) return p.name;
  return `${p.year}-${String(p.month).padStart(2, "0")} ${p.half === 1 ? "1st Half" : "2nd Half"}`;
}

export default async function ExecutivePage() {
  const user = await requireUser();

  const today       = new Date();
  const todayIso    = today.toISOString().slice(0, 10);
  const in7         = new Date(today); in7.setDate(today.getDate() + 7);
  const in30        = new Date(today); in30.setDate(today.getDate() + 30);
  const monthStart  = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart   = new Date(today.getFullYear(), 0, 1);
  const last30Start = new Date(today); last30Start.setDate(today.getDate() - 29);
  const last6mo     = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [
    headcount,
    terminatedCount,
    positionCount,
    departments,
    contractExpiring30,
    contractExpiring7,
    todayAttendance,
    monthlyAttendance,  // for trend + per-dept rate
    pendingLeaveCount,
    onLeaveTodayCount,
    ytdLeaveByType,
    ytdLeaveByStatus,
    birthdaysAll,
    latestPeriod,
    recentPeriods,      // last 6 periods with payslips for trend
    otByBand,           // last 30d OT grouped by band
    monthlyOt,          // this month OT with dept info
    monthlyLeave,       // this month approved leave with dept info
    recentHires,
    recentLeaveRequests,
    recentPayrollRuns,
    hiringByMonth,
  ] = await Promise.all([
    // Headcount
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.count({ where: { status: "TERMINATED" } }),
    prisma.position.count({ where: { active: true } }),

    // Departments with employee counts
    prisma.department.findMany({
      where: { active: true },
      include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
      orderBy: { name: "asc" },
    }),

    // Contracts
    prisma.employee.count({ where: { status: "ACTIVE", contractExpiry: { not: null, lte: in30, gte: today } } }),
    prisma.employee.count({ where: { status: "ACTIVE", contractExpiry: { not: null, lte: in7,  gte: today } } }),

    // Attendance today
    prisma.attendanceDay.groupBy({
      by: ["am"],
      where: { date: { equals: new Date(todayIso) } },
      _count: { am: true },
    }).catch(() => []),

    // Attendance this month (for trend + per-dept)
    prisma.attendanceDay.findMany({
      where: { date: { gte: monthStart } },
      select: { date: true, am: true, pm: true, employee: { select: { departmentId: true } } },
    }).catch(() => []),

    // Leave counts
    prisma.leaveRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", startDate: { lte: new Date(todayIso) }, endDate: { gte: new Date(todayIso) } },
    }).catch(() => 0),

    // YTD leave by type + status
    prisma.leaveRequest.groupBy({
      by: ["type"],
      where: { createdAt: { gte: yearStart } },
      _count: { id: true },
    }).catch(() => []),
    prisma.leaveRequest.groupBy({
      by: ["status"],
      where: { createdAt: { gte: yearStart } },
      _count: { id: true },
    }).catch(() => []),

    // Birthdays — all active, filter to this month in Node
    prisma.employee.findMany({
      where: { status: "ACTIVE", birthday: { not: null } },
      select: { id: true, nameEn: true, nameKh: true, birthday: true },
    }).catch(() => []),

    // Latest period
    prisma.payPeriod.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
      select: { id: true, year: true, month: true, half: true, name: true, locked: true, payrollDate: true, endDate: true },
    }),

    // Last 6 periods with payslip aggregates
    prisma.payPeriod.findMany({
      take: 6,
      orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
      include: { payslips: { select: { grossUsd: true, netUsd: true } } },
    }).catch(() => []),

    // OT by band — last 30 days
    prisma.overtimeEntry.groupBy({
      by: ["band"],
      where: { date: { gte: last30Start }, status: "APPROVED" },
      _sum: { hours: true, amountUsd: true },
    }).catch(() => []),

    // This month's OT with dept info (for per-dept)
    prisma.overtimeEntry.findMany({
      where: { date: { gte: monthStart }, status: "APPROVED" },
      select: { hours: true, amountUsd: true, employee: { select: { departmentId: true } } },
    }).catch(() => []),

    // This month's approved leave with dept info (for per-dept)
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: new Date(todayIso) },
        endDate: { gte: monthStart },
      },
      select: { employee: { select: { departmentId: true } } },
    }).catch(() => []),

    // Recent hires (last 60 days)
    prisma.employee.findMany({
      where: { hireDate: { gte: new Date(today.getFullYear(), today.getMonth() - 1, 1) } },
      orderBy: { hireDate: "desc" },
      take: 8,
      select: { id: true, nameEn: true, nameKh: true, hireDate: true, department: { select: { name: true } } },
    }).catch(() => []),

    // Recent leave requests
    prisma.leaveRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, type: true, status: true, startDate: true, endDate: true,
        employee: { select: { nameEn: true } },
      },
    }).catch(() => []),

    // Recent payroll runs
    prisma.payrollRun.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        period: { select: { year: true, month: true, half: true, name: true } },
        createdBy: { select: { name: true } },
        payslips: { select: { grossUsd: true } },
      },
    }).catch(() => []),

    // Hiring trend — last 6 months
    prisma.employee.findMany({
      where: { hireDate: { gte: last6mo } },
      select: { hireDate: true },
    }).then((emps) => {
      const counts: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        counts[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
      }
      emps.forEach((e) => {
        const k = `${e.hireDate.getFullYear()}-${String(e.hireDate.getMonth() + 1).padStart(2, "0")}`;
        if (k in counts) counts[k]++;
      });
      return Object.entries(counts).map(([month, count]) => ({ month, count }));
    }).catch(() => [] as { month: string; count: number }[]),
  ]);

  // ─── Post-process: attendance trend (daily % for this month) ─────────────────
  const trendMap = new Map<string, { present: number; total: number }>();
  for (const a of monthlyAttendance) {
    const dateKey = a.date.toISOString().slice(0, 10);
    const curr = trendMap.get(dateKey) ?? { present: 0, total: 0 };
    curr.total += 2;
    if (a.am === "PRESENT") curr.present++;
    if (a.pm === "PRESENT") curr.present++;
    trendMap.set(dateKey, curr);
  }
  const attendanceTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { present, total }]) => ({
      date,
      present,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    }));

  // ─── Per-department stats ─────────────────────────────────────────────────────
  const deptAttMap = new Map<number, { present: number; total: number }>();
  for (const a of monthlyAttendance) {
    const did = a.employee.departmentId;
    if (!did) continue;
    const curr = deptAttMap.get(did) ?? { present: 0, total: 0 };
    curr.total += 2;
    if (a.am === "PRESENT") curr.present++;
    if (a.pm === "PRESENT") curr.present++;
    deptAttMap.set(did, curr);
  }
  const deptLeaveMap = new Map<number, number>();
  for (const l of monthlyLeave) {
    const did = l.employee.departmentId;
    if (!did) continue;
    deptLeaveMap.set(did, (deptLeaveMap.get(did) ?? 0) + 1);
  }
  const deptOtMap = new Map<number, { hours: number; amountUsd: number }>();
  for (const o of monthlyOt) {
    const did = o.employee.departmentId;
    if (!did) continue;
    const curr = deptOtMap.get(did) ?? { hours: 0, amountUsd: 0 };
    curr.hours += Number(o.hours);
    curr.amountUsd += Number(o.amountUsd);
    deptOtMap.set(did, curr);
  }

  const deptStats = departments.map((d) => {
    const att = deptAttMap.get(d.id);
    const ot  = deptOtMap.get(d.id);
    return {
      id: d.id,
      name: d.name,
      count: d._count.employees,
      attendancePct: att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
      leaveCount: deptLeaveMap.get(d.id) ?? 0,
      otHours: ot ? Math.round(ot.hours * 10) / 10 : 0,
      otCostUsd: ot ? Math.round(ot.amountUsd * 100) / 100 : 0,
    };
  });

  // ─── Attendance today ─────────────────────────────────────────────────────────
  const presentToday = todayAttendance.find((r) => r.am === "PRESENT")?._count?.am ?? 0;
  const leaveToday   = todayAttendance.find((r) => r.am === "LEAVE")?._count?.am ?? 0;
  const absentToday  = todayAttendance.find((r) => r.am === "ABSENT")?._count?.am ?? 0;
  const totalToday   = presentToday + leaveToday + absentToday;
  const attendanceRateToday = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : null;

  // ─── Monthly attendance rate ──────────────────────────────────────────────────
  let totalSlots = 0, presentSlots = 0;
  for (const a of monthlyAttendance) {
    totalSlots += 2;
    if (a.am === "PRESENT") presentSlots++;
    if (a.pm === "PRESENT") presentSlots++;
  }
  const monthlyAttendanceRate = totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : null;

  // ─── Birthdays this month ─────────────────────────────────────────────────────
  const birthdaysThisMonth = birthdaysAll.filter((e) => {
    if (!e.birthday) return false;
    const b = new Date(e.birthday);
    return b.getMonth() === today.getMonth();
  }).map((e) => ({
    id: e.id, nameEn: e.nameEn, nameKh: e.nameKh,
    birthday: (e.birthday as Date).toISOString(),
  }));

  // ─── Payroll trend (last 6 periods, oldest first for chart) ──────────────────
  const payrollTrend = [...recentPeriods].reverse().map((p) => ({
    label: plabel(p),
    grossUsd: Math.round(p.payslips.reduce((a, s) => a + Number(s.grossUsd), 0) * 100) / 100,
    netUsd:   Math.round(p.payslips.reduce((a, s) => a + Number(s.netUsd),   0) * 100) / 100,
    count:    p.payslips.length,
    locked:   p.locked,
  }));

  // ─── Latest period aggregate ──────────────────────────────────────────────────
  const lpSlips = latestPeriod
    ? await prisma.payslip.aggregate({
        where: { periodId: latestPeriod.id },
        _sum: { grossUsd: true },
        _count: true,
      })
    : null;

  const periodFinalized = latestPeriod
    ? await prisma.payslip.count({ where: { periodId: latestPeriod.id, finalized: true } })
    : 0;

  // ─── OT this month total ──────────────────────────────────────────────────────
  let otThisMonth = 0;
  for (const o of monthlyOt) otThisMonth += Number(o.amountUsd);

  // ─── Production data (best-effort) ───────────────────────────────────────────
  const invSummaryPromise = getInventoryExecutiveSummary().catch(() => null);
  const purchSummaryPromise = getPurchasingExecutiveSummary().catch(() => null);
  const salesSummaryPromise = getSalesExecutiveSummary().catch(() => null);
  const qmsSummaryPromise = getQualityExecutiveSummary().catch(() => null);
  const cmmsSummaryPromise = getMaintenanceExecutiveSummary().catch(() => null);
  const financeSummaryPromise = getFinanceExecutiveSummary().catch(() => null);
  const [prodMonthly, prodMachineStatus, prodOrdersStatus, prodQcLast30] = await Promise.all([
    prisma.dailyProductionReport.aggregate({
      where: { reportDate: { gte: monthStart } },
      _sum: { meshProducedKg: true, downtimeMinutes: true },
    }).catch(() => null),
    prisma.machine.groupBy({ by: ["status"], _count: { id: true } }).catch(() => [] as { status: string; _count: { id: number } }[]),
    prisma.productionOrder.groupBy({ by: ["status"], _count: { id: true } }).catch(() => [] as { status: string; _count: { id: number } }[]),
    prisma.qualityCheck.findMany({
      where: { checkDate: { gte: new Date(today.getFullYear(), today.getMonth() - 1, 1) } },
      select: { result: true },
    }).catch(() => [] as { result: string }[]),
  ]);

  const prodMonthlyKg = prodMonthly ? Math.round(Number(prodMonthly._sum.meshProducedKg ?? 0) * 10) / 10 : null;
  const prodDowntimeMin = prodMonthly ? Number(prodMonthly._sum.downtimeMinutes ?? 0) : null;
  let totalMachines = 0;
  for (const m of prodMachineStatus) totalMachines += m._count.id;
  const operationalMachines = prodMachineStatus.find((m) => m.status === "OPERATIONAL")?._count.id ?? 0;
  const machineUtilPct = totalMachines > 0 ? Math.round((operationalMachines / totalMachines) * 100) : null;
  const ordersInProgress = prodOrdersStatus.find((o) => o.status === "IN_PROGRESS")?._count.id ?? 0;
  const ordersCompleted = prodOrdersStatus.find((o) => o.status === "COMPLETED")?._count.id ?? 0;
  const qcPassCount = prodQcLast30.filter((c) => c.result === "PASS").length;
  const qcPassRate = prodQcLast30.length > 0 ? Math.round((qcPassCount / prodQcLast30.length) * 100) : null;

  const [invSummary, purchSummary, salesSummary, qmsSummary, cmmsSummary, financeSummary] = await Promise.all([invSummaryPromise, purchSummaryPromise, salesSummaryPromise, qmsSummaryPromise, cmmsSummaryPromise, financeSummaryPromise]);

  const [
    portalActiveCustomers,
    portalActiveSuppliers,
    portalOpenTickets,
    portalPendingAccounts,
    portalOpenThreads,
  ] = await Promise.all([
    prisma.portalAccount.count({ where: { status: "ACTIVE", portalType: "CUSTOMER" } }).catch(() => null),
    prisma.portalAccount.count({ where: { status: "ACTIVE", portalType: "SUPPLIER" } }).catch(() => null),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }).catch(() => null),
    prisma.portalAccount.count({ where: { status: "PENDING" } }).catch(() => null),
    prisma.portalThread.count({ where: { status: "OPEN" } }).catch(() => null),
  ]);

  // Smart Factory live data
  const todayStr = today.toISOString().slice(0, 10);
  const [
    factoryTodayReports,
    factoryRunningCount,
    factoryTotalCount,
    factoryActiveAlarms,
    factoryCriticalAlarms,
    factoryOpenOrders,
    factoryLatestOEE,
  ] = await Promise.all([
    prisma.dailyProductionReport.aggregate({
      where: { reportDate: { equals: new Date(todayStr) } },
      _sum: { meshProducedKg: true, downtimeMinutes: true },
    }).catch(() => null),
    prisma.machineMetric.count({ where: { isRunning: true } }).catch(() => null),
    prisma.machine.count({ where: { status: { not: "RETIRED" } } }).catch(() => null),
    prisma.factoryAlarm.count({ where: { status: "ACTIVE" } }).catch(() => null),
    prisma.factoryAlarm.count({ where: { status: "ACTIVE", severity: "CRITICAL" } }).catch(() => null),
    prisma.productionOrder.count({ where: { status: "IN_PROGRESS" } }).catch(() => null),
    prisma.oEERecord.aggregate({
      where: { periodType: "DAY", periodDate: { gte: new Date(Date.now() - 7 * 86400000) } },
      _avg: { oee: true },
    }).catch(() => null),
  ]);
  const factoryTodayOutputKg = factoryTodayReports?._sum.meshProducedKg ? Math.round(Number(factoryTodayReports._sum.meshProducedKg) * 10) / 10 : null;
  const factoryTodayDowntimeMin = factoryTodayReports?._sum.downtimeMinutes ?? null;
  const factoryEfficiencyPct = factoryTodayDowntimeMin !== null ? Math.round(((480 - Math.min(factoryTodayDowntimeMin, 480)) / 480) * 100) : null;
  const factoryOEE = factoryLatestOEE?._avg.oee ? Math.round(Number(factoryLatestOEE._avg.oee) * 10) / 10 : null;
  const invData      = invSummary     && invSummary.ok     ? invSummary.data     : null;
  const purchData    = purchSummary   && purchSummary.ok   ? purchSummary.data   : null;
  const salesData    = salesSummary   && salesSummary.ok   ? salesSummary.data   : null;
  const qmsData      = qmsSummary     && qmsSummary.ok     ? qmsSummary.data     : null;
  const cmmsData     = cmmsSummary    && cmmsSummary.ok    ? cmmsSummary.data    : null;
  const financeData  = financeSummary && financeSummary.ok ? financeSummary.data : null;

  // ─── Shape for client ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>
      <ExecutiveDashboard
        canExport={can(user.role, "report.export")}
        // Counts
        headcount={headcount}
        terminatedCount={terminatedCount}
        positionCount={positionCount}
        // Today
        presentToday={presentToday}
        leaveToday={leaveToday}
        absentToday={absentToday}
        attendanceRateToday={attendanceRateToday}
        monthlyAttendanceRate={monthlyAttendanceRate}
        // Contracts / birthdays
        contractExpiring7={contractExpiring7}
        contractExpiring30={contractExpiring30}
        birthdaysThisMonth={birthdaysThisMonth}
        // Leave
        pendingLeaveCount={pendingLeaveCount}
        onLeaveTodayCount={onLeaveTodayCount}
        leaveByType={ytdLeaveByType.map((r) => ({ type: r.type, count: r._count.id }))}
        leaveByStatus={ytdLeaveByStatus.map((r) => ({ status: r.status, count: r._count.id }))}
        // Attendance trend
        attendanceTrend={attendanceTrend}
        // Department stats
        departments={deptStats}
        // Payroll
        latestPeriod={latestPeriod ? {
          label: plabel(latestPeriod),
          locked: latestPeriod.locked,
          grossUsd: lpSlips?._sum?.grossUsd ? Number(lpSlips._sum.grossUsd) : null,
          count: lpSlips?._count ?? 0,
          finalizedCount: periodFinalized,
          payrollDate: latestPeriod.payrollDate?.toISOString() ?? null,
          periodEndDate: latestPeriod.endDate.toISOString(),
        } : null}
        payrollTrend={payrollTrend}
        // OT
        otByBand={otByBand.map((r) => ({
          band: r.band,
          hours: Number(r._sum.hours ?? 0),
          amountUsd: Number(r._sum.amountUsd ?? 0),
        }))}
        otThisMonthUsd={Math.round(otThisMonth * 100) / 100}
        // Production
        prodMonthlyKg={prodMonthlyKg}
        prodDowntimeMin={prodDowntimeMin}
        machineUtilPct={machineUtilPct}
        ordersInProgress={ordersInProgress}
        ordersCompleted={ordersCompleted}
        qcPassRate={qcPassRate}
        machinesByStatus={prodMachineStatus.map((m) => ({ status: m.status, count: m._count.id }))}
        // Inventory
        invTotalValueUsd={invData?.totalValueUsd ?? null}
        invTotalItems={invData?.totalItems ?? null}
        invLowStockCount={invData?.lowStockCount ?? null}
        invOutOfStockCount={invData?.outOfStockCount ?? null}
        // Purchasing
        purchPendingApproval={purchData?.pendingApproval ?? null}
        purchAwaitingReceipt={purchData?.awaitingReceipt ?? null}
        purchMonthlySpendUsd={purchData?.monthlySpendUsd ?? null}
        purchLowStockCount={purchData?.lowStockCount ?? null}
        salesRevenueThisMonth={salesData?.revenueThisMonth ?? null}
        salesActiveOrders={salesData?.activeOrders ?? null}
        salesPendingQuotations={salesData?.pendingQuotations ?? null}
        salesOutstandingDeliveries={salesData?.deliveriesThisWeek ?? null}
        // Quality
        qmsPassRate={qmsData?.passRate ?? null}
        qmsOpenNCRs={qmsData?.openNCRs ?? null}
        qmsOverdueCAPAs={qmsData?.overdueCapas ?? null}
        qmsCertificatesThisMonth={qmsData?.certificatesThisMonth ?? null}
        // Maintenance (CMMS)
        cmmsAvailability={cmmsData?.availability ?? null}
        cmmsOpenWOs={cmmsData?.openWOs ?? null}
        cmmsDueThisWeek={cmmsData?.dueThisWeek ?? null}
        cmmsMonthlyCostUsd={cmmsData?.monthlyCostUsd ?? null}
        // Finance & Accounting
        financeRevenue={financeData?.revenue ?? null}
        financeExpenses={financeData?.expenses ?? null}
        financeProfit={financeData?.profit ?? null}
        financeCashBalance={financeData?.cashBalance ?? null}
        financeArBalance={financeData?.arBalance ?? null}
        financeApBalance={financeData?.apBalance ?? null}
        // Portal
        portalActiveCustomers={portalActiveCustomers}
        portalActiveSuppliers={portalActiveSuppliers}
        portalOpenTickets={portalOpenTickets}
        portalPendingAccounts={portalPendingAccounts}
        portalOpenThreads={portalOpenThreads}
        // Smart Factory
        factoryRunningMachines={factoryRunningCount}
        factoryTotalMachines={factoryTotalCount}
        factoryActiveAlarms={factoryActiveAlarms}
        factoryCriticalAlarms={factoryCriticalAlarms}
        factoryTodayOutputKg={factoryTodayOutputKg}
        factoryEfficiencyPct={factoryEfficiencyPct}
        factoryOEE={factoryOEE}
        factoryTodayDowntimeMin={factoryTodayDowntimeMin !== null ? Number(factoryTodayDowntimeMin) : null}
        factoryOpenOrders={factoryOpenOrders}
        // Hiring trend
        hiringByMonth={hiringByMonth}
        // Recent activity
        recentHires={recentHires.map((e) => ({
          id: e.id, nameEn: e.nameEn, nameKh: e.nameKh,
          departmentName: e.department?.name ?? null,
          hireDate: e.hireDate.toISOString(),
        }))}
        recentLeave={recentLeaveRequests.map((l) => ({
          id: String(l.id),
          nameEn: l.employee.nameEn,
          type: l.type,
          status: l.status,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
        }))}
        recentPayrollRuns={recentPayrollRuns.map((r) => ({
          id: String(r.id),
          periodLabel: plabel(r.period),
          createdBy: r.createdBy.name,
          grossUsd: Math.round(r.payslips.reduce((a, s) => a + Number(s.grossUsd), 0) * 100) / 100,
          count: r.payslips.length,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
