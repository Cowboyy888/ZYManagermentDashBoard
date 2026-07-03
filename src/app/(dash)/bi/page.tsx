import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getFinanceExecutiveSummary } from "@/actions/finance";
import { getSalesExecutiveSummary } from "@/actions/sales";
import { getInventoryExecutiveSummary } from "@/actions/inventory";
import { getPurchasingExecutiveSummary } from "@/actions/purchasing";
import { getQualityExecutiveSummary } from "@/actions/quality";
import { getMaintenanceExecutiveSummary } from "@/actions/maintenance";
import { getAlerts } from "@/actions/bi";
import { BIDashboard } from "./BIDashboard";

export const metadata: Metadata = { title: "BI & Analytics — CEO Dashboard" };

export default async function BIPage() {
  const user = await requireUser();
  if (!can(user.role, "bi.read")) return <div style={{ padding: 24, color: "var(--red)" }}>Access denied.</div>;

  const today      = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const last6mo    = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [
    financeResult, salesResult, invResult, purchResult, qmsResult, cmmsResult, alertsResult,
    headcount, presentToday, monthlyAtt,
    monthlyProdAgg, monthlySalesAgg, last6moProd,
  ] = await Promise.all([
    getFinanceExecutiveSummary().catch(() => null),
    getSalesExecutiveSummary().catch(() => null),
    getInventoryExecutiveSummary().catch(() => null),
    getPurchasingExecutiveSummary().catch(() => null),
    getQualityExecutiveSummary().catch(() => null),
    getMaintenanceExecutiveSummary().catch(() => null),
    getAlerts().catch(() => null),
    prisma.employee.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    prisma.attendanceDay.groupBy({
      by: ["am"],
      where: { date: { equals: new Date(today.toISOString().slice(0, 10)) } },
      _count: { am: true },
    }).catch(() => []),
    prisma.attendanceDay.findMany({
      where: { date: { gte: monthStart } },
      select: { am: true, pm: true },
    }).catch(() => []),
    prisma.dailyProductionReport.aggregate({
      where: { reportDate: { gte: monthStart } },
      _sum: { meshProducedKg: true },
    }).catch(() => null),
    prisma.salesOrder.aggregate({
      where: { orderDate: { gte: monthStart }, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _sum: { totalUsd: true },
    }).catch(() => null),
    // Last 6 months production for trend
    prisma.dailyProductionReport.findMany({
      where: { reportDate: { gte: last6mo } },
      select: { reportDate: true, meshProducedKg: true },
    }).catch(() => []),
  ]);

  // Attendance this month
  let mPresent = 0, mTotal = 0;
  for (const a of monthlyAtt) {
    mTotal += 2;
    if (a.am === "PRESENT") mPresent++;
    if (a.pm === "PRESENT") mPresent++;
  }
  const attendanceRate = mTotal > 0 ? Math.round((mPresent / mTotal) * 100) : null;

  // Present today
  const presentTodayCount = presentToday.find((r) => r.am === "PRESENT")?._count?.am ?? 0;
  const attendancePct = headcount > 0 ? Math.round((presentTodayCount / headcount) * 100) : null;

  // 6-month production trend for chart
  const prodTrend: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    prodTrend[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  for (const r of last6moProd) {
    const k = `${r.reportDate.getFullYear()}-${String(r.reportDate.getMonth() + 1).padStart(2, "0")}`;
    if (k in prodTrend) prodTrend[k] += Number(r.meshProducedKg ?? 0);
  }
  const productionTrend = Object.entries(prodTrend).map(([month, kg]) => ({
    month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    kg: Math.round(kg * 10) / 10,
  }));

  const finance  = financeResult?.ok  ? financeResult.data  : null;
  const sales    = salesResult?.ok    ? salesResult.data    : null;
  const inv      = invResult?.ok      ? invResult.data      : null;
  const purch    = purchResult?.ok    ? purchResult.data    : null;
  const qms      = qmsResult?.ok      ? qmsResult.data      : null;
  const cmms     = cmmsResult?.ok     ? cmmsResult.data     : null;
  const alertData = alertsResult?.ok  ? alertsResult.data   : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>CEO Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Company-wide KPIs and analytics overview</p>
        </div>
        {alertData && alertData.counts.critical > 0 && (
          <a href="/bi/alerts" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            ⚠ {alertData.counts.critical} Critical Alert{alertData.counts.critical > 1 ? "s" : ""}
          </a>
        )}
      </div>
      <BIDashboard
        canManage={can(user.role, "bi.manage")}
        // Finance
        revenue={finance?.revenue ?? null}
        expenses={finance?.expenses ?? null}
        profit={finance?.profit ?? null}
        cashBalance={finance?.cashBalance ?? null}
        arBalance={finance?.arBalance ?? null}
        apBalance={finance?.apBalance ?? null}
        // HR
        headcount={headcount}
        attendanceRate={attendanceRate}
        presentTodayPct={attendancePct}
        // Production
        monthKg={Number(monthlyProdAgg?._sum?.meshProducedKg ?? 0)}
        machineAvailability={cmms?.availability ?? null}
        productionTrend={productionTrend}
        // Sales
        salesRevenue={sales?.revenueThisMonth ?? null}
        activeOrders={sales?.activeOrders ?? null}
        // Inventory
        inventoryValue={inv?.totalValueUsd ?? null}
        lowStockCount={inv?.lowStockCount ?? null}
        // Purchasing
        monthlySpend={purch?.monthlySpendUsd ?? null}
        // Quality
        qcPassRate={qms?.passRate ?? null}
        openNCRs={qms?.openNCRs ?? null}
        // Maintenance
        openWOs={cmms?.openWOs ?? null}
        // Alerts
        alertCounts={alertData?.counts ?? null}
      />
    </div>
  );
}
