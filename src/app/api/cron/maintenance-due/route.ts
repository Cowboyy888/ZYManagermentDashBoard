import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { notifyRole } from "@/lib/notify";
import { sendTelegramMessage } from "@/lib/telegram";
import { nowICT } from "@/lib/utils/date";

export const maxDuration = 30;

export async function POST(request: Request) {
  
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = nowICT();
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const dueSoon = await prisma.maintenanceSchedule.findMany({
      where: {
        active: true,
        nextDueDate: { lte: in7Days },
      },
      select: {
        id: true,
        title: true,
        frequency: true,
        nextDueDate: true,
        machine: { select: { name: true, code: true } },
        assignedTo: { select: { nameEn: true } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    for (const schedule of dueSoon) {
      const daysUntil = Math.ceil((schedule.nextDueDate.getTime() - today.getTime()) / 86_400_000);
      const isOverdue = daysUntil < 0;
      const level = isOverdue ? "critical" : daysUntil <= 2 ? "critical" : "warning";

      await notifyRole(["OWNER", "HR_MANAGER"], {
        title: isOverdue
          ? `Maintenance overdue: ${schedule.machine.name}`
          : `Maintenance due soon: ${schedule.machine.name}`,
        body: `${schedule.title} (${schedule.frequency}) — ${
          isOverdue
            ? `${Math.abs(daysUntil)} day(s) overdue`
            : daysUntil === 0
            ? "due today"
            : `due in ${daysUntil} day(s)`
        }. Machine: ${schedule.machine.code}${schedule.assignedTo ? ` | Assigned: ${schedule.assignedTo.nameEn}` : ""}.`,
        level,
        module: "maintenance",
        href: `/maintenance/schedules`,
      });
    }

    if (dueSoon.length > 0) {
      const overdue = dueSoon.filter((s) => s.nextDueDate < today);
      const lines = [
        `*🔧 ZY Steel — Maintenance Due Alert*`,
        ``,
        `${dueSoon.length} maintenance task(s) due within 7 days:`,
        ...dueSoon.slice(0, 8).map((s) => {
          const days = Math.ceil((s.nextDueDate.getTime() - today.getTime()) / 86_400_000);
          const icon = days < 0 ? "🔴" : days <= 2 ? "🟠" : "🟡";
          const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`;
          return `${icon} ${s.machine.name} — ${s.title} (${label})`;
        }),
        dueSoon.length > 8 ? `... and ${dueSoon.length - 8} more` : ``,
        ``,
        overdue.length > 0 ? `🚨 ${overdue.length} task(s) already overdue!` : ``,
        `_Sent automatically by ZYSteel HR Bot_`,
      ].filter((l) => l !== undefined);

      await sendTelegramMessage(lines.join("\n"));
    }

    return NextResponse.json({ ok: true, processed: dueSoon.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/maintenance-due]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
