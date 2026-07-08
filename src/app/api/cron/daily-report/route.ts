import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { startOfTodayICT, nowICT } from "@/lib/utils/date";

export const maxDuration = 30;

export async function POST(request: Request) {
  
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startOfDay = startOfTodayICT();
    const today = nowICT();
    const startOfMonth = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);

    const [attendance, pendingLeave, pendingOT, openOrders, machines, wireRemaining] = await Promise.all([
      prisma.attendanceDay.findMany({ where: { date: { gte: startOfDay } }, select: { am: true, pm: true } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.overtimeEntry.count({ where: { status: "PENDING" } }),
      prisma.productionOrder.count({ where: { status: { in: ["DRAFT", "IN_PROGRESS"] } } }),
      prisma.machine.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.wireInventory.aggregate({ _sum: { remainingKg: true } }),
    ]);

    const present = attendance.filter((a) => a.am === "PRESENT" && a.pm === "PRESENT").length;
    const absent = attendance.filter((a) => a.am === "ABSENT" && a.pm === "ABSENT").length;

    const machineOp = machines.find((m) => m.status === "OPERATIONAL")?._count.id ?? 0;
    const machineMaint = machines.find((m) => m.status === "UNDER_MAINTENANCE")?._count.id ?? 0;

    const wireKg = Number(wireRemaining._sum.remainingKg ?? 0).toLocaleString();

    const todayReport = await prisma.dailyProductionReport.findFirst({
      where: { reportDate: { gte: startOfDay } },
      orderBy: { meshProducedKg: "desc" },
    });

    const lines: string[] = [
      `*🏭 ZY Steel Daily Report — ${today.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}*`,
      "",
      `*👥 HR*`,
      `Attendance: ✅ ${present} full-day present · ❌ ${absent} full-day absent`,
      `Leave requests pending: ${pendingLeave}`,
      `Overtime pending approval: ${pendingOT}`,
      "",
      `*🏭 Production*`,
      `Machines: 🟢 ${machineOp} operational · 🔧 ${machineMaint} under maintenance`,
      `Open orders: ${openOrders}`,
      `Wire stock remaining: ${wireKg} kg`,
    ];

    if (todayReport) {
      lines.push(`Today's output: ${Number(todayReport.meshProducedKg).toLocaleString()} kg mesh · ${Number(todayReport.wireConsumedKg).toLocaleString()} kg wire`);
    } else {
      lines.push(`Today's production report: _not yet logged_`);
    }

    lines.push("", `_Sent automatically by ZYSteel HR Bot_`);

    await sendTelegramMessage(lines.join("\n"));

    return NextResponse.json({ ok: true, sent: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/daily-report]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
