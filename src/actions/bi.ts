"use server";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission.";
    return e.message;
  }
  return "Unexpected error";
}
function ok<T>(data: T) { return { ok: true as const, data }; }
function err(e: string) { return { ok: false as const, error: e }; }

// ── Linear regression helpers ─────────────────────────────────────────────────

function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const sumX  = (n * (n - 1)) / 2;
  const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;
  let sumY = 0, sumXY = 0;
  for (let i = 0; i < n; i++) { sumY += values[i]; sumXY += i * values[i]; }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function project(values: number[], ahead: number): number[] {
  const { slope, intercept } = linearRegression(values);
  const n = values.length;
  return Array.from({ length: ahead }, (_, i) => Math.max(0, intercept + slope * (n + i)));
}

function monthLabel(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ── HR Analytics ──────────────────────────────────────────────────────────────

export async function getHRAnalytics(days = 90) {
  try {
    await guard("bi.read");
    const today      = new Date();
    const since      = new Date(today); since.setDate(today.getDate() - days);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last6mo    = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const in90days   = new Date(today); in90days.setDate(today.getDate() + 90);

    const [
      headcount, terminatedLast6mo, departments,
      attendanceLast30, leaveLast6mo,
      otByMonth, contractExpiring,
    ] = await Promise.all([
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.employee.count({ where: { status: "TERMINATED", updatedAt: { gte: last6mo } } }),
      prisma.department.findMany({
        where: { active: true },
        include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
        orderBy: { name: "asc" },
      }),
      // Daily attendance for last 30 days
      prisma.attendanceDay.findMany({
        where: { date: { gte: since } },
        select: { date: true, am: true, pm: true },
      }),
      // Leave last 6 months
      prisma.leaveRequest.findMany({
        where: { createdAt: { gte: last6mo }, status: "APPROVED" },
        select: { type: true, createdAt: true },
      }),
      // OT by month (last 6 months)
      prisma.overtimeEntry.findMany({
        where: { date: { gte: last6mo }, status: "APPROVED" },
        select: { date: true, hours: true, amountUsd: true, band: true },
      }),
      // Employees with contracts expiring in 90 days
      prisma.employee.findMany({
        where: { status: "ACTIVE", contractExpiry: { not: null, gte: today, lte: in90days } },
        select: { id: true, nameEn: true, contractExpiry: true,
                  department: { select: { name: true } },
                  position:   { select: { name: true } } },
        orderBy: { contractExpiry: "asc" },
      }),
    ]);

    // Attendance daily trend (group by date)
    const attMap: Record<string, { present: number; total: number }> = {};
    for (const a of attendanceLast30) {
      const k = (a.date as Date).toISOString().slice(0, 10);
      attMap[k] = attMap[k] ?? { present: 0, total: 0 };
      attMap[k].total += 2;
      if (a.am === "PRESENT") attMap[k].present++;
      if (a.pm === "PRESENT") attMap[k].present++;
    }
    const attendanceTrend = Object.entries(attMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { present, total }]) => ({
        date,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        present, total,
      }));

    // This month attendance rate
    const thisMonthAtt = attendanceLast30.filter((a) => (a.date as Date) >= monthStart);
    let mPresent = 0, mTotal = 0;
    for (const a of thisMonthAtt) {
      mTotal += 2;
      if (a.am === "PRESENT") mPresent++;
      if (a.pm === "PRESENT") mPresent++;
    }
    const monthlyAttRate = mTotal > 0 ? Math.round((mPresent / mTotal) * 100) : null;

    // Leave by type
    const leaveByType: Record<string, number> = {};
    for (const l of leaveLast6mo) {
      leaveByType[l.type] = (leaveByType[l.type] ?? 0) + 1;
    }

    // Leave monthly trend
    const leaveTrendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      leaveTrendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    for (const l of leaveLast6mo) {
      const k = `${l.createdAt.getFullYear()}-${String(l.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (k in leaveTrendMap) leaveTrendMap[k]++;
    }
    const leaveTrend = Object.entries(leaveTrendMap).map(([month, count]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    }));

    // OT monthly trend
    const otTrendMap: Record<string, { hours: number; cost: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      otTrendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { hours: 0, cost: 0 };
    }
    for (const o of otByMonth) {
      const k = `${(o.date as Date).getFullYear()}-${String((o.date as Date).getMonth() + 1).padStart(2, "0")}`;
      if (k in otTrendMap) {
        otTrendMap[k].hours += Number(o.hours);
        otTrendMap[k].cost  += Number(o.amountUsd);
      }
    }
    const otTrend = Object.entries(otTrendMap).map(([month, v]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      hours: Math.round(v.hours * 10) / 10,
      cost:  Math.round(v.cost * 100) / 100,
    }));

    const turnoverRate = headcount > 0 ? Math.round((terminatedLast6mo / (headcount + terminatedLast6mo)) * 100 * 10) / 10 : 0;

    return ok({
      headcount, terminatedLast6mo, turnoverRate,
      monthlyAttRate,
      attendanceTrend: attendanceTrend.slice(-30),
      leaveByType: Object.entries(leaveByType).map(([type, count]) => ({ type, count })),
      leaveTrend,
      otTrend,
      departmentHeadcount: departments.map((d) => ({ id: d.id, name: d.name, count: d._count.employees })),
      contractExpiring: contractExpiring.map((e) => ({
        id: e.id, nameEn: e.nameEn,
        contractExpiry: (e.contractExpiry as Date).toISOString(),
        department: e.department?.name ?? null,
        position:   e.position?.name ?? null,
        daysLeft: Math.ceil(((e.contractExpiry as Date).getTime() - today.getTime()) / 86400000),
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

// ── Production Analytics ──────────────────────────────────────────────────────

export async function getProductionAnalytics(days = 90) {
  try {
    await guard("bi.read");
    const today      = new Date();
    const since      = new Date(today); since.setDate(today.getDate() - days);
    const last6mo    = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      dailyReports, machinesByStatus, ordersByStatus,
      monthlyReports,
    ] = await Promise.all([
      prisma.dailyProductionReport.findMany({
        where: { reportDate: { gte: since } },
        select: { reportDate: true, meshProducedKg: true, downtimeMinutes: true },
        orderBy: { reportDate: "asc" },
      }),
      prisma.machine.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.productionOrder.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.dailyProductionReport.findMany({
        where: { reportDate: { gte: last6mo } },
        select: { reportDate: true, meshProducedKg: true, downtimeMinutes: true },
      }),
    ]);

    // Monthly production trend (6 months)
    const monthMap: Record<string, { kg: number; downtimeMin: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { kg: 0, downtimeMin: 0 };
    }
    for (const r of monthlyReports) {
      const k = `${(r.reportDate as Date).getFullYear()}-${String((r.reportDate as Date).getMonth() + 1).padStart(2, "0")}`;
      if (k in monthMap) {
        monthMap[k].kg += Number(r.meshProducedKg ?? 0);
        monthMap[k].downtimeMin += Number(r.downtimeMinutes ?? 0);
      }
    }
    const productionTrend = Object.entries(monthMap).map(([month, v]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      kg: Math.round(v.kg * 10) / 10,
      downtimeHours: Math.round(v.downtimeMin / 6) / 10,
    }));

    // This month stats
    const thisMonthReports = monthlyReports.filter((r) => (r.reportDate as Date) >= monthStart);
    const monthKg = thisMonthReports.reduce((s, r) => s + Number(r.meshProducedKg ?? 0), 0);
    const monthDowntimeMin = thisMonthReports.reduce((s, r) => s + Number(r.downtimeMinutes ?? 0), 0);

    // Machine status
    const statusMap: Record<string, number> = {};
    for (const m of machinesByStatus) statusMap[m.status] = m._count.id;
    const totalMachines  = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const operational    = statusMap["OPERATIONAL"] ?? 0;
    const availability   = totalMachines > 0 ? Math.round((operational / totalMachines) * 100) : 0;

    return ok({
      totalMachines, operational, availability,
      monthKg: Math.round(monthKg * 10) / 10,
      monthDowntimeHours: Math.round(monthDowntimeMin / 6) / 10,
      dailyTrend: dailyReports.map((r) => ({
        date: (r.reportDate as Date).toISOString().slice(0, 10),
        kg:   Math.round(Number(r.meshProducedKg ?? 0) * 10) / 10,
        downtimeMin: Number(r.downtimeMinutes ?? 0),
      })),
      productionTrend,
      machinesByStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      ordersByStatus: ordersByStatus.map((r) => ({
        status: r.status, count: r._count.id,
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  level: "critical" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  href: string;
}

export async function getAlerts() {
  try {
    await guard("bi.read");
    const today   = new Date();
    const in30    = new Date(today); in30.setDate(today.getDate() + 30);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      overdueInvoices,
      overdueBills,
      lowStockCount,
      offlineMachines,
      overdueWOs,
      criticalNCRs,
      contractExpiring30,
      inspectionsThisMonth,
      passCount,
      pendingExpenses,
    ] = await Promise.all([
      prisma.invoice.count({ where: { status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: today } } }),
      prisma.supplierBill.count({ where: { status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: today } } }),
      prisma.inventoryItem.count({ where: { status: "ACTIVE", currentStock: { lte: prisma.inventoryItem.fields.minStock } } }),
      prisma.machine.count({ where: { status: "OFFLINE" } }),
      prisma.workOrder.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, scheduledDate: { lt: today } } }),
      prisma.nonConformance.count({ where: { severity: "CRITICAL", status: { notIn: ["CLOSED", "CANCELLED"] } } }),
      prisma.employee.count({ where: { status: "ACTIVE", contractExpiry: { not: null, gte: today, lte: in30 } } }),
      prisma.qualityInspection.count({ where: { inspectionDate: { gte: monthStart } } }),
      prisma.qualityInspection.count({ where: { result: "PASS", inspectionDate: { gte: monthStart } } }),
      prisma.expense.count({ where: { status: "PENDING" } }),
    ]);

    const alerts: Alert[] = [];

    const passRate = inspectionsThisMonth > 0 ? Math.round((passCount / inspectionsThisMonth) * 100) : null;

    if (overdueInvoices > 0)
      alerts.push({ id: "ar-overdue", level: "critical", module: "Finance", title: `${overdueInvoices} Overdue Invoice${overdueInvoices > 1 ? "s" : ""}`, detail: "Customer invoices past due date", href: "/finance/invoices" });
    if (overdueBills > 0)
      alerts.push({ id: "ap-overdue", level: "critical", module: "Finance", title: `${overdueBills} Overdue Bill${overdueBills > 1 ? "s" : ""}`, detail: "Supplier bills past due date", href: "/finance/bills" });
    if (criticalNCRs > 0)
      alerts.push({ id: "ncr-critical", level: "critical", module: "Quality", title: `${criticalNCRs} Critical NCR${criticalNCRs > 1 ? "s" : ""} Open`, detail: "Critical non-conformances require immediate action", href: "/quality/ncr" });
    if (offlineMachines > 0)
      alerts.push({ id: "machine-offline", level: "critical", module: "Maintenance", title: `${offlineMachines} Machine${offlineMachines > 1 ? "s" : ""} Offline`, detail: "Production capability affected", href: "/maintenance/assets" });
    if (passRate !== null && passRate < 80)
      alerts.push({ id: "qc-low", level: "critical", module: "Quality", title: `Quality Pass Rate ${passRate}%`, detail: "Below 80% threshold this month", href: "/bi/quality" });
    if (overdueWOs > 0)
      alerts.push({ id: "wo-overdue", level: "warning", module: "Maintenance", title: `${overdueWOs} Overdue Work Order${overdueWOs > 1 ? "s" : ""}`, detail: "Scheduled maintenance past due", href: "/maintenance/work-orders" });
    if (lowStockCount > 0)
      alerts.push({ id: "low-stock", level: "warning", module: "Inventory", title: `${lowStockCount} Low Stock Item${lowStockCount > 1 ? "s" : ""}`, detail: "At or below minimum stock level", href: "/inventory/items" });
    if (contractExpiring30 > 0)
      alerts.push({ id: "contract-expiry", level: "warning", module: "HR", title: `${contractExpiring30} Contract${contractExpiring30 > 1 ? "s" : ""} Expiring in 30 Days`, detail: "Employee contracts need renewal review", href: "/bi/hr" });
    if (pendingExpenses > 5)
      alerts.push({ id: "pending-expenses", level: "info", module: "Finance", title: `${pendingExpenses} Pending Expense Claims`, detail: "Awaiting approval", href: "/finance/expenses" });

    return ok({ alerts, counts: { critical: alerts.filter((a) => a.level === "critical").length, warning: alerts.filter((a) => a.level === "warning").length, info: alerts.filter((a) => a.level === "info").length } });
  } catch (e) { return err(errMsg(e)); }
}

// ── Forecasting ───────────────────────────────────────────────────────────────

export async function getForecastData() {
  try {
    await guard("bi.read");
    const today   = new Date();
    const last6mo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [salesOrders, productionReports, inventoryItems] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { orderDate: { gte: last6mo }, status: { notIn: ["DRAFT", "CANCELLED"] } },
        select: { orderDate: true, totalUsd: true },
      }),
      prisma.dailyProductionReport.findMany({
        where: { reportDate: { gte: last6mo } },
        select: { reportDate: true, meshProducedKg: true },
      }),
      prisma.inventoryItem.findMany({
        where: { status: "ACTIVE" },
        select: { currentStock: true, unitCostUsd: true },
      }),
    ]);

    // Build 6-month buckets
    const buckets: Record<string, { revenue: number; kg: number }> = {};
    const bucketKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[k] = { revenue: 0, kg: 0 };
      bucketKeys.push(k);
    }

    for (const o of salesOrders) {
      const k = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, "0")}`;
      if (k in buckets) buckets[k].revenue += Number(o.totalUsd);
    }
    for (const r of productionReports) {
      const k = `${(r.reportDate as Date).getFullYear()}-${String((r.reportDate as Date).getMonth() + 1).padStart(2, "0")}`;
      if (k in buckets) buckets[k].kg += Number(r.meshProducedKg ?? 0);
    }

    const revValues = bucketKeys.map((k) => buckets[k].revenue);
    const kgValues  = bucketKeys.map((k) => buckets[k].kg);
    const revForecast = project(revValues, 3);
    const kgForecast  = project(kgValues, 3);

    const totalInventoryValue = inventoryItems.reduce((s, i) => s + Number(i.currentStock) * Number(i.unitCostUsd ?? 0), 0);
    // Simple inventory forecast: current value ± trend (assume 5% monthly growth/decline based on revenue trend)
    const revSlope = linearRegression(revValues).slope;
    const revMean  = revValues.reduce((a, b) => a + b, 0) / 6;
    const growthRate = revMean > 0 ? revSlope / revMean : 0;
    const invForecast = [1, 2, 3].map((n) => totalInventoryValue * Math.pow(1 + growthRate, n));

    const historicalData = bucketKeys.map((k, i) => ({
      month: new Date(k + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue: Math.round(buckets[k].revenue * 100) / 100,
      productionKg: Math.round(buckets[k].kg * 10) / 10,
      actual: true,
    }));

    const forecastData = [0, 1, 2].map((i) => ({
      month: monthLabel(i + 1),
      revenue: Math.round(revForecast[i] * 100) / 100,
      productionKg: Math.round(kgForecast[i] * 10) / 10,
      inventoryValue: Math.round(invForecast[i] * 100) / 100,
      actual: false,
    }));

    return ok({
      historical: historicalData,
      forecast:   forecastData,
      currentInventoryValue: Math.round(totalInventoryValue * 100) / 100,
    });
  } catch (e) { return err(errMsg(e)); }
}
