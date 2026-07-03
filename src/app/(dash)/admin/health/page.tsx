import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import SystemHealth from "./SystemHealth";

export const dynamic = "force-dynamic";

const CRON_JOBS = [
  {
    name: "Daily Report",
    path: "/api/cron/daily-report",
    description: "Send Telegram summary of attendance, production, and machine status",
    schedule: "Daily 07:00",
  },
  {
    name: "Contract Expiry",
    path: "/api/cron/contract-expiry",
    description: "Alert HR of employee contracts expiring within 30 days",
    schedule: "Daily 08:00",
  },
  {
    name: "Low Stock",
    path: "/api/cron/low-stock",
    description: "Alert purchasing team of inventory items at or below minimum stock",
    schedule: "Daily 08:30",
  },
  {
    name: "Maintenance Due",
    path: "/api/cron/maintenance-due",
    description: "Alert maintenance team of PM schedules due within 7 days",
    schedule: "Daily 09:00",
  },
  {
    name: "Payroll Reminder",
    path: "/api/cron/payroll-reminder",
    description: "Remind HR to process payroll when pay periods are approaching",
    schedule: "Daily 09:30",
  },
];

export default async function SystemHealthPage() {
  const user = await requireUser();
  if (!can(user.role, "system.health")) redirect("/");

  const yesterday = new Date(Date.now() - 86_400_000);

  const [dbCheck, activeUsers, unreadNotifications, recentAuditCount, pendingLeave, pendingOT, openOrders, lowStockItems] =
    await Promise.allSettled([
      prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`,
      prisma.user.count({ where: { active: true } }),
      prisma.notification.count({ where: { read: false } }),
      prisma.auditLog.count({ where: { createdAt: { gte: yesterday } } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.overtimeEntry.count({ where: { status: "PENDING" } }),
      prisma.productionOrder.count({ where: { status: { in: ["DRAFT", "IN_PROGRESS"] } } }),
      prisma.inventoryItem.findMany({
        where: { status: "ACTIVE", minStock: { gt: 0 } },
        select: { currentStock: true, minStock: true },
      }),
    ]);

  const dbOk = dbCheck.status === "fulfilled";

  const data = {
    db: { ok: dbOk, latencyMs: dbOk ? 1 : 0 },
    uptime: Math.floor(process.uptime()),
    activeUsers: activeUsers.status === "fulfilled" ? activeUsers.value : 0,
    unreadNotifications: unreadNotifications.status === "fulfilled" ? unreadNotifications.value : 0,
    recentAuditCount: recentAuditCount.status === "fulfilled" ? recentAuditCount.value : 0,
    pendingLeave: pendingLeave.status === "fulfilled" ? pendingLeave.value : 0,
    pendingOT: pendingOT.status === "fulfilled" ? pendingOT.value : 0,
    openOrders: openOrders.status === "fulfilled" ? openOrders.value : 0,
    lowStockCount:
      lowStockItems.status === "fulfilled"
        ? lowStockItems.value.filter((i) => Number(i.currentStock) <= Number(i.minStock)).length
        : 0,
    cronJobs: CRON_JOBS,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">System Health</h1>
      <SystemHealth data={data} />
    </div>
  );
}
